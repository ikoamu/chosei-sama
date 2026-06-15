// =============================================================================
// scheduler/slots
// 共通空き時間の算出と、候補スロットの切り出し・スコアリング（純粋関数）。
// =============================================================================

import type { Interval, SlotCandidate, SlotPreferences } from "./types";
import { mergeIntervals, subtractIntervals } from "./intervals";
import { localHour } from "./timezone";

/** 全員の busy を合算し、勤務ウィンドウから差し引いて「全員が空いている区間」を返す。 */
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

/** 候補開始時刻のスコア。希望時間帯に入っていれば加点する。 */
export function scoreSlot(start: number, prefs: SlotPreferences): number {
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
    // グリッドに合わせて開始時刻を切り上げ（30 分刻みなら :00 / :30 に揃う）。
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
