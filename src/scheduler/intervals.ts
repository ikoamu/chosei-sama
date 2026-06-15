// =============================================================================
// scheduler/intervals
// 区間演算（純粋関数・I/O なし）。エンジンの心臓部でテスト対象。
// =============================================================================

import type { Interval } from "./types";

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

/** 2 つの区間が重なるか。 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}
