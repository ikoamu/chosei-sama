// =============================================================================
// scheduler/windows
// 勤務時間ウィンドウの生成（純粋関数）。
// =============================================================================

import type { Interval, SlotPreferences } from "./types";
import { localParts, startOfLocalDay, zonedWallToUtc } from "./timezone";

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
  // 安全弁（最大 366 日）。
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
    // 24h 進めてからローカル日付の頭にスナップ（DST のずれを吸収）。
    cursor = startOfLocalDay(cursor + DAY + DAY / 2, tz);
  }
  return windows;
}
