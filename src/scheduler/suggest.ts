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

  const { busy, unreadable } = await queryFreeBusy(
    opts.accessToken,
    opts.calendarIds,
    tMin,
    tMax,
    opts.preferences.timeZone
  );
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

export async function suggestRecurringSlots(
  opts: SuggestRecurringOptions
): Promise<SuggestRecurringResult> {
  const prefs = opts.preferences;
  const tz = prefs.timeZone;
  const first =
    typeof opts.firstDate === "number"
      ? opts.firstDate
      : opts.firstDate.getTime();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  // 全オカレンスを覆う期間を一度に照会する。
  const horizonEnd = first + (opts.occurrences * opts.everyNWeeks + 1) * WEEK;

  const { busy, unreadable } = await queryFreeBusy(
    opts.accessToken,
    opts.calendarIds,
    first,
    horizonEnd,
    tz
  );
  if (unreadable.length > 0) {
    return { candidates: [], unreadable };
  }
  const mergedBusy = mergeIntervals([...busy.values()].flat());

  const wh = prefs.workingHours ?? { startHour: 9, endHour: 18 };
  const allowed = prefs.allowedWeekdays ?? [1, 2, 3, 4, 5];
  const gran = prefs.granularityMinutes ?? 30;
  const dur = prefs.durationMinutes;
  const bufferMs = (prefs.bufferMinutes ?? 0) * 60_000;

  const results: RecurringCandidate[] = [];

  for (const weekday of allowed) {
    // この曜日の最初の開催日（first 以降）を求める。
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
  return {
    candidates: results.slice(0, prefs.maxResults ?? 5),
    unreadable: []
  };
}
