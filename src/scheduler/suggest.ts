// =============================================================================
// scheduler/suggest
// 高レベル API。FreeBusy 照会 → 区間演算を束ねて候補を返すオーケストレーション層。
//   - suggestSlots          … 単発ミーティング
//   - suggestRecurringSlots … 定期開催
// =============================================================================

import type {
  Interval,
  RecurringCandidate,
  SlotCandidate,
  SlotPreferences
} from "./types";
import { queryFreeBusy } from "./freebusy";
import { mergeIntervals, overlaps } from "./intervals";
import { localParts, startOfLocalDay, zonedWallToUtc } from "./timezone";
import { workingWindowsInRange } from "./windows";
import { commonFree, findSlots, scoreSlot } from "./slots";

// ---------------------------------------------------------------------------
// 単発ミーティングの候補を出す
//   例:「D さんと 30 分、直近 1 週間で空いている枠を出して」
// ---------------------------------------------------------------------------

export interface SuggestSlotsOptions {
  accessToken: string; // 依頼者の OAuth アクセストークン
  calendarIds: string[]; // 参加者全員のカレンダー ID（=メールアドレス）
  timeMin: Date | number;
  timeMax: Date | number;
  preferences: SlotPreferences;
}

export interface SuggestSlotsResult {
  candidates: SlotCandidate[];
  /** free/busy を読めなかった参加者（カレンダー ID）。空でなければ候補は出さない。 */
  unreadable: string[];
}

export async function suggestSlots(
  opts: SuggestSlotsOptions
): Promise<SuggestSlotsResult> {
  const tMin =
    typeof opts.timeMin === "number" ? opts.timeMin : opts.timeMin.getTime();
  const tMax =
    typeof opts.timeMax === "number" ? opts.timeMax : opts.timeMax.getTime();

  const { busy, unreadable } = await queryFreeBusy({
    accessToken: opts.accessToken,
    calendarIds: opts.calendarIds,
    timeMin: tMin,
    timeMax: tMax,
    timeZone: opts.preferences.timeZone
  });
  // 1人でも読めなければ「全員空いている」を保証できないため候補を出さない。
  if (unreadable.length > 0) {
    return { candidates: [], unreadable };
  }

  const windows = workingWindowsInRange(tMin, tMax, opts.preferences);
  const free = commonFree(
    [...busy.values()],
    windows,
    (opts.preferences.bufferMinutes ?? 0) * 60_000
  );
  return { candidates: findSlots(free, opts.preferences), unreadable: [] };
}

// ---------------------------------------------------------------------------
// 定期開催の枠を出す
//   例:「A,B,C で隔週 1h、来月から。午後希望。全員が空く曜日・時間は？」
//   「ある曜日×時刻」を候補テンプレートとし、全オカレンスで空いているものだけ採用。
// ---------------------------------------------------------------------------

export interface SuggestRecurringOptions {
  accessToken: string; // 依頼者の OAuth アクセストークン
  calendarIds: string[];
  firstDate: Date | number; // 探索の下限日。曜日は preferences.allowedWeekdays で絞る
  occurrences: number; // 検証する開催回数（例: 6）
  everyNWeeks: number; // 1=毎週, 2=隔週
  preferences: SlotPreferences;
}

export interface SuggestRecurringResult {
  candidates: RecurringCandidate[];
  /** free/busy を読めなかった参加者（カレンダー ID）。空でなければ候補は出さない。 */
  unreadable: string[];
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** 定期候補の探索・検証に必要な文脈をまとめたもの。 */
interface RecurringContext {
  tz: string;
  mergedBusy: Interval[];
  occurrences: number;
  everyNWeeks: number;
  durationMs: number;
  durationMin: number;
  bufferMs: number;
  startMin: number; // 勤務開始（0時からの分）
  endMin: number; // 勤務終了（0時からの分）
  gran: number; // 探索の粒度（分）
  prefs: SlotPreferences;
}

/** first 以降で最初に weekday に当たる「その日の 0 時」。無ければ -1。 */
function firstOccurrenceDayOnOrAfter(
  first: number,
  weekday: number,
  tz: string
): number {
  const base = startOfLocalDay(first, tz);
  for (let d = 0; d < 7; d++) {
    const dayStart = startOfLocalDay(first + d * DAY, tz);
    if (localParts(dayStart, tz).weekday === weekday && dayStart >= base) {
      return dayStart;
    }
  }
  return -1;
}

/**
 * firstDay を起点に everyNWeeks 間隔で occurrences 回ぶんの枠を作る。
 * すべて空いていれば各オカレンスの Interval を、1つでも埋まっていれば null を返す。
 */
function freeOccurrences(
  firstDay: number,
  hour: number,
  minute: number,
  ctx: RecurringContext
): Interval[] | null {
  const occ: Interval[] = [];
  for (let k = 0; k < ctx.occurrences; k++) {
    const dayMs = startOfLocalDay(
      firstDay + k * ctx.everyNWeeks * WEEK,
      ctx.tz
    );
    const p = localParts(dayMs, ctx.tz);
    const s = zonedWallToUtc(
      { year: p.year, month: p.month, day: p.day, hour, minute },
      ctx.tz
    );
    const slot: Interval = { start: s, end: s + ctx.durationMs };
    const padded: Interval = {
      start: slot.start - ctx.bufferMs,
      end: slot.end + ctx.bufferMs
    };
    if (ctx.mergedBusy.some((b) => overlaps(padded, b))) {
      return null;
    }
    occ.push(slot);
  }
  return occ;
}

/** 1曜日について、勤務時間内の各開始時刻を試し、成立した定期候補を返す。 */
function candidatesForWeekday(
  weekday: number,
  firstDay: number,
  ctx: RecurringContext
): RecurringCandidate[] {
  const out: RecurringCandidate[] = [];
  for (let m = ctx.startMin; m + ctx.durationMin <= ctx.endMin; m += ctx.gran) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const occ = freeOccurrences(firstDay, h, min, ctx);
    if (!occ) {
      continue;
    }
    out.push({
      weekday,
      startISOFirst: new Date(occ[0].start).toISOString(),
      localTime: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      occurrenceStartsISO: occ.map((o) => new Date(o.start).toISOString()),
      score: scoreSlot(occ[0].start, ctx.prefs)
    });
  }
  return out;
}

export async function suggestRecurringSlots(
  opts: SuggestRecurringOptions
): Promise<SuggestRecurringResult> {
  const prefs = opts.preferences;
  const tz = prefs.timeZone;
  const first =
    typeof opts.firstDate === "number"
      ? opts.firstDate
      : opts.firstDate.getTime();
  // 全オカレンスを覆う期間を一度に照会する。
  const horizonEnd = first + (opts.occurrences * opts.everyNWeeks + 1) * WEEK;

  const { busy, unreadable } = await queryFreeBusy({
    accessToken: opts.accessToken,
    calendarIds: opts.calendarIds,
    timeMin: first,
    timeMax: horizonEnd,
    timeZone: tz
  });
  if (unreadable.length > 0) {
    return { candidates: [], unreadable };
  }

  const wh = prefs.workingHours ?? { startHour: 9, endHour: 18 };
  const allowed = prefs.allowedWeekdays ?? [1, 2, 3, 4, 5];
  const ctx: RecurringContext = {
    tz,
    mergedBusy: mergeIntervals([...busy.values()].flat()),
    occurrences: opts.occurrences,
    everyNWeeks: opts.everyNWeeks,
    durationMs: prefs.durationMinutes * 60_000,
    durationMin: prefs.durationMinutes,
    bufferMs: (prefs.bufferMinutes ?? 0) * 60_000,
    startMin: wh.startHour * 60 + (wh.startMinute ?? 0),
    endMin: wh.endHour * 60 + (wh.endMinute ?? 0),
    gran: prefs.granularityMinutes ?? 30,
    prefs
  };

  const results: RecurringCandidate[] = [];
  for (const weekday of allowed) {
    const firstDay = firstOccurrenceDayOnOrAfter(first, weekday, tz);
    if (firstDay < 0) {
      continue;
    }
    results.push(...candidatesForWeekday(weekday, firstDay, ctx));
  }

  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.weekday - b.weekday ||
      a.localTime.localeCompare(b.localTime)
  );
  return {
    candidates: results.slice(0, prefs.maxResults ?? 5),
    unreadable: []
  };
}
