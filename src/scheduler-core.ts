// =============================================================================
// scheduler-core.ts
// Google Calendar の FreeBusy を使って、複数メンバーの共通空き時間を探すコア。
// Cloudflare Workers / Agents 上で動くよう、Web Crypto と fetch のみで実装。
// 外部ライブラリ・Node固有APIには依存しない。
// =============================================================================

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

/** 時間区間。内部計算はすべて epoch ミリ秒で行う（タイムゾーン由来のバグを避けるため）。 */
export interface Interval {
  start: number; // epoch ms (inclusive)
  end: number; // epoch ms (exclusive)
}

/** Google サービスアカウントの鍵（JSON鍵ファイルの該当フィールド）。 */
export interface ServiceAccount {
  client_email: string;
  private_key: string; // PEM (PKCS#8)
}

export interface WorkingHours {
  startHour: number; // 例: 9
  startMinute?: number; // 既定 0
  endHour: number; // 例: 18
  endMinute?: number; // 既定 0
}

export interface SlotPreferences {
  /** 会議の長さ（分）。 */
  durationMinutes: number;
  /** IANAタイムゾーン。例: 'Asia/Tokyo'。 */
  timeZone: string;
  /** 勤務時間帯。既定 9:00-18:00。 */
  workingHours?: WorkingHours;
  /** 候補に含める曜日。0=日, 1=月 ... 6=土。既定は平日 [1,2,3,4,5]。 */
  allowedWeekdays?: number[];
  /** 優先したい時間帯（ローカル時刻の時）。例: 午後なら {startHour:13, endHour:17}。 */
  preferredWindow?: { startHour: number; endHour: number };
  /** 候補開始時刻の刻み（分）。既定 30。 */
  granularityMinutes?: number;
  /** 返す候補数の上限。既定 5。 */
  maxResults?: number;
  /** 既存予定の前後に確保するバッファ（分）。既定 0。 */
  bufferMinutes?: number;
}

export interface SlotCandidate {
  start: number;
  end: number;
  startISO: string;
  endISO: string;
  score: number;
}

// ---------------------------------------------------------------------------
// 認証: サービスアカウント -> アクセストークン（Web Crypto / RS256）
// Workspace 全体のカレンダーを読むには、ドメイン全体の委任 + subject 偽装を使う。
// subject に「成り代わるユーザー（依頼者など）」のメールを渡す。
// ---------------------------------------------------------------------------

function base64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlFromString(str: string): string {
  return base64urlFromBytes(new TextEncoder().encode(str));
}

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function getAccessToken(
  sa: ServiceAccount,
  subject: string,
  scopes: string[] = ["https://www.googleapis.com/auth/calendar.readonly"]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    sub: subject // ドメイン委任で成り代わる相手
  };

  const unsigned = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(
    JSON.stringify(claim)
  )}`;
  const key = await importServiceAccountKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64urlFromBytes(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// FreeBusy 照会
// 返るのは「busy（埋まっている区間）」だけ。予定の中身（タイトル等）は取得しない。
// ---------------------------------------------------------------------------

export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: number,
  timeMax: number,
  timeZone: string
): Promise<Map<string, Interval[]>> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      timeZone,
      items: calendarIds.map((id) => ({ id }))
    })
  });
  if (!res.ok) {
    throw new Error(`freeBusy failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    calendars?: Record<
      string,
      { busy?: { start: string; end: string }[]; errors?: unknown[] }
    >;
  };

  const result = new Map<string, Interval[]>();
  for (const [id, cal] of Object.entries(data.calendars ?? {})) {
    if (cal.errors?.length) {
      // 例: そのカレンダーへの参照権限が無い等。呼び出し側で扱えるよう投げる。
      throw new Error(
        `freeBusy error for ${id}: ${JSON.stringify(cal.errors)}`
      );
    }
    const busy = (cal.busy ?? []).map((b) => ({
      start: Date.parse(b.start),
      end: Date.parse(b.end)
    }));
    result.set(id, busy);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 区間演算（純粋関数・I/Oなし。ここがエンジンの心臓部でテスト対象）
// ---------------------------------------------------------------------------

/** 重なり・隣接する区間をマージしてソート済みで返す。 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/** window の中で busy に覆われていない部分（空き）を返す。busy はマージ済み前提でなくてもよい。 */
export function subtractIntervals(
  window: Interval,
  busy: Interval[]
): Interval[] {
  const merged = mergeIntervals(busy);
  const free: Interval[] = [];
  let cursor = window.start;
  for (const b of merged) {
    if (b.end <= cursor) {
      continue;
    }
    if (b.start >= window.end) {
      break;
    }
    if (b.start > cursor) {
      free.push({ start: cursor, end: Math.min(b.start, window.end) });
    }
    cursor = Math.max(cursor, b.end);
    if (cursor >= window.end) {
      break;
    }
  }
  if (cursor < window.end) {
    free.push({ start: cursor, end: window.end });
  }
  return free.filter((i) => i.end > i.start);
}

/** 2つの区間が重なるか。 */
function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

// --- タイムゾーン処理 -------------------------------------------------------

/** その瞬間における tz のUTCオフセット(ms)。local = utc + offset。 */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) {
    m[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    +m.year,
    +m.month - 1,
    +m.day,
    +m.hour === 24 ? 0 : +m.hour,
    +m.minute,
    +m.second
  );
  return asUTC - date.getTime();
}

/** tz のローカル壁時計時刻 (y, m, d, h, min) を UTC epoch ms に変換。 */
function zonedWallToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(timeZone, new Date(guess));
  return guess - offset;
}

/** epoch ms の tz ローカルな年月日・時分・曜日を返す。 */
function localParts(ms: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(ms))) {
    m[p.type] = p.value;
  }
  const wd: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return {
    year: +m.year,
    month: +m.month,
    day: +m.day,
    hour: +m.hour === 24 ? 0 : +m.hour,
    minute: +m.minute,
    weekday: wd[m.weekday]
  };
}

/** tz における ms の「その日の0時」の UTC epoch ms。 */
function startOfLocalDay(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  return zonedWallToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

/** ローカル時刻に直したときの「時（小数）」。スコアリング用。 */
function localHour(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  return p.hour + p.minute / 60;
}

// ---------------------------------------------------------------------------
// 勤務時間ウィンドウの生成
// ---------------------------------------------------------------------------

/** [timeMin, timeMax) の範囲内で、許可曜日の勤務時間帯ウィンドウを列挙する。 */
export function workingWindowsInRange(
  timeMin: number,
  timeMax: number,
  prefs: SlotPreferences
): Interval[] {
  const tz = prefs.timeZone;
  const wh = prefs.workingHours ?? { startHour: 9, endHour: 18 };
  const allowed = prefs.allowedWeekdays ?? [1, 2, 3, 4, 5];
  const windows: Interval[] = [];

  const DAY = 24 * 60 * 60 * 1000;
  let cursor = startOfLocalDay(timeMin, tz);
  // 安全弁（最大366日）。
  for (let guard = 0; cursor < timeMax && guard < 366; guard++) {
    const p = localParts(cursor, tz);
    if (allowed.includes(p.weekday)) {
      const ws = zonedWallToUtc(
        p.year,
        p.month,
        p.day,
        wh.startHour,
        wh.startMinute ?? 0,
        tz
      );
      const we = zonedWallToUtc(
        p.year,
        p.month,
        p.day,
        wh.endHour,
        wh.endMinute ?? 0,
        tz
      );
      const s = Math.max(ws, timeMin);
      const e = Math.min(we, timeMax);
      if (e > s) {
        windows.push({ start: s, end: e });
      }
    }
    // 24h進めてからローカル日付の頭にスナップ（DSTのずれを吸収）。
    cursor = startOfLocalDay(cursor + DAY + DAY / 2, tz);
  }
  return windows;
}

// ---------------------------------------------------------------------------
// 共通空き時間の算出
// ---------------------------------------------------------------------------

/** 全員のbusyを合算し、勤務ウィンドウから差し引いて「全員が空いている区間」を返す。 */
export function commonFree(
  busyByPerson: Interval[][],
  workingWindows: Interval[],
  bufferMs = 0
): Interval[] {
  const allBusy: Interval[] = [];
  for (const list of busyByPerson) {
    for (const b of list) {
      allBusy.push({ start: b.start - bufferMs, end: b.end + bufferMs });
    }
  }
  const merged = mergeIntervals(allBusy);
  const free: Interval[] = [];
  for (const w of workingWindows) {
    for (const f of subtractIntervals(w, merged)) {
      free.push(f);
    }
  }
  return free;
}

// ---------------------------------------------------------------------------
// 候補スロットの探索とスコアリング（単発ミーティング用）
// ---------------------------------------------------------------------------

function scoreSlot(start: number, prefs: SlotPreferences): number {
  let score = 0;
  if (prefs.preferredWindow) {
    const h = localHour(start, prefs.timeZone);
    if (
      h >= prefs.preferredWindow.startHour &&
      h < prefs.preferredWindow.endHour
    ) {
      score += 100; // 希望時間帯に入っていれば大きく加点
    }
  }
  return score;
}

/** 空き区間群から、指定の長さ・刻みで候補スロットを切り出してスコア順に返す。 */
export function findSlots(
  free: Interval[],
  prefs: SlotPreferences
): SlotCandidate[] {
  const dur = prefs.durationMinutes * 60_000;
  const gran = (prefs.granularityMinutes ?? 30) * 60_000;
  const out: SlotCandidate[] = [];

  for (const iv of free) {
    // グリッドに合わせて開始時刻を切り上げ（30分刻みなら :00 / :30 に揃う）。
    let start = Math.ceil(iv.start / gran) * gran;
    while (start + dur <= iv.end) {
      const end = start + dur;
      out.push({
        start,
        end,
        startISO: new Date(start).toISOString(),
        endISO: new Date(end).toISOString(),
        score: scoreSlot(start, prefs)
      });
      start += gran;
    }
  }

  // スコア降順 → 同点は早い時刻優先。
  out.sort((a, b) => b.score - a.score || a.start - b.start);
  return out.slice(0, prefs.maxResults ?? 5);
}

// ---------------------------------------------------------------------------
// 高レベルAPI（1）: 単発ミーティングの候補を出す
//   例:「Dさんと30分、直近1週間で空いている枠を出して」
// ---------------------------------------------------------------------------

export interface SuggestSlotsOptions {
  serviceAccount: ServiceAccount;
  subject: string; // 成り代わるユーザー（通常は依頼者本人）
  calendarIds: string[]; // 参加者全員のカレンダーID（=メールアドレス）
  timeMin: Date | number;
  timeMax: Date | number;
  preferences: SlotPreferences;
}

export async function suggestSlots(
  opts: SuggestSlotsOptions
): Promise<SlotCandidate[]> {
  const tMin =
    typeof opts.timeMin === "number" ? opts.timeMin : opts.timeMin.getTime();
  const tMax =
    typeof opts.timeMax === "number" ? opts.timeMax : opts.timeMax.getTime();

  const token = await getAccessToken(opts.serviceAccount, opts.subject);
  const busyMap = await queryFreeBusy(
    token,
    opts.calendarIds,
    tMin,
    tMax,
    opts.preferences.timeZone
  );

  const windows = workingWindowsInRange(tMin, tMax, opts.preferences);
  const free = commonFree(
    [...busyMap.values()],
    windows,
    (opts.preferences.bufferMinutes ?? 0) * 60_000
  );
  return findSlots(free, opts.preferences);
}

// ---------------------------------------------------------------------------
// 高レベルAPI（2）: 定期開催の枠を出す
//   例:「A,B,Cで隔週1h、来月から。午後希望。全員が空く曜日・時間は？」
//   「ある曜日×時刻」を候補テンプレートとし、全オカレンスで空いているものだけ採用。
// ---------------------------------------------------------------------------

export interface RecurringCandidate {
  weekday: number;
  startISOFirst: string; // 初回の開始時刻
  localTime: string; // "13:00" のような表記
  occurrenceStartsISO: string[]; // 各回の開始時刻
  score: number;
}

export interface SuggestRecurringOptions {
  serviceAccount: ServiceAccount;
  subject: string;
  calendarIds: string[];
  firstDate: Date | number; // この日以降の最初の該当曜日から開始
  occurrences: number; // 検証する開催回数（例: 6）
  everyNWeeks: number; // 1=毎週, 2=隔週
  preferences: SlotPreferences;
}

export async function suggestRecurringSlots(
  opts: SuggestRecurringOptions
): Promise<RecurringCandidate[]> {
  const prefs = opts.preferences;
  const tz = prefs.timeZone;
  const first =
    typeof opts.firstDate === "number"
      ? opts.firstDate
      : opts.firstDate.getTime();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  // 全オカレンスを覆う期間を一度に照会する。
  const horizonEnd = first + (opts.occurrences * opts.everyNWeeks + 1) * WEEK;

  const token = await getAccessToken(opts.serviceAccount, opts.subject);
  const busyMap = await queryFreeBusy(
    token,
    opts.calendarIds,
    first,
    horizonEnd,
    tz
  );
  const mergedBusy = mergeIntervals([...busyMap.values()].flat());

  const wh = prefs.workingHours ?? { startHour: 9, endHour: 18 };
  const allowed = prefs.allowedWeekdays ?? [1, 2, 3, 4, 5];
  const gran = prefs.granularityMinutes ?? 30;
  const dur = prefs.durationMinutes;
  const bufferMs = (prefs.bufferMinutes ?? 0) * 60_000;

  const results: RecurringCandidate[] = [];

  for (const weekday of allowed) {
    // この曜日の最初の開催日（first以降）を求める。
    let firstOccurrenceDay = -1;
    for (let d = 0; d < 7; d++) {
      const dayStart = startOfLocalDay(first + d * 24 * 60 * 60 * 1000, tz);
      if (
        localParts(dayStart, tz).weekday === weekday &&
        dayStart >= startOfLocalDay(first, tz)
      ) {
        firstOccurrenceDay = dayStart;
        break;
      }
    }
    if (firstOccurrenceDay < 0) {
      continue;
    }

    const startMin = wh.startHour * 60 + (wh.startMinute ?? 0);
    const endMin = wh.endHour * 60 + (wh.endMinute ?? 0);

    for (let m = startMin; m + dur <= endMin; m += gran) {
      const h = Math.floor(m / 60);
      const min = m % 60;

      // 各オカレンスの区間を作り、全部が空いているか確認。
      const occ: Interval[] = [];
      let allFree = true;
      for (let k = 0; k < opts.occurrences; k++) {
        const dayMs = startOfLocalDay(
          firstOccurrenceDay + k * opts.everyNWeeks * WEEK,
          tz
        );
        const p = localParts(dayMs, tz);
        const s = zonedWallToUtc(p.year, p.month, p.day, h, min, tz);
        const slot: Interval = { start: s, end: s + dur * 60_000 };
        const padded: Interval = {
          start: slot.start - bufferMs,
          end: slot.end + bufferMs
        };
        if (mergedBusy.some((b) => overlaps(padded, b))) {
          allFree = false;
          break;
        }
        occ.push(slot);
      }
      if (!allFree) {
        continue;
      }

      results.push({
        weekday,
        startISOFirst: new Date(occ[0].start).toISOString(),
        localTime: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
        occurrenceStartsISO: occ.map((o) => new Date(o.start).toISOString()),
        score: scoreSlot(occ[0].start, prefs)
      });
    }
  }

  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.weekday - b.weekday ||
      a.localTime.localeCompare(b.localTime)
  );
  return results.slice(0, prefs.maxResults ?? 5);
}
