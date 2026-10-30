// =============================================================================
// server/api/suggest
// 候補提案（POST /api/suggest）。確定した調整条件を scheduler の
// suggestSlots / suggestRecurringSlots に変換して候補を返す。
// 日付（YYYY-MM-DD）は TIME_ZONE の 0 時を起点に epoch ms へ変換する。
// =============================================================================

import {
  suggestRecurringSlots,
  suggestSlots,
  zonedWallToUtc
} from "../../scheduler";
import type { SlotPreferences } from "../../scheduler/types";
import type { SchedulingCriteria, SuggestResult } from "../../shared/criteria";

/** 調整さまは日本時間固定で扱う。 */
const TIME_ZONE = "Asia/Tokyo";
const DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD の TIME_ZONE における 0 時（epoch ms）。 */
function startOfDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return zonedWallToUtc({ year, month, day, hour: 0, minute: 0 }, TIME_ZONE);
}

/** 必須項目（missingRequired）を検証済みの調整条件で候補を出す。 */
export async function suggestFromCriteria(
  accessToken: string,
  members: string[],
  criteria: SchedulingCriteria
): Promise<SuggestResult> {
  const preferences: SlotPreferences = {
    durationMinutes: criteria.durationMinutes!,
    timeZone: TIME_ZONE,
    allowedWeekdays: criteria.weekdays,
    preferredWindow: criteria.preferredWindow ?? undefined
  };
  const { candidates, unreadable } =
    criteria.kind === "recurring"
      ? await suggestRecurringSlots({
          accessToken,
          calendarIds: members,
          firstDate: startOfDate(criteria.startDate),
          occurrences: criteria.occurrences!,
          everyNWeeks: criteria.everyNWeeks,
          preferences
        })
      : await suggestSlots({
          accessToken,
          calendarIds: members,
          timeMin: startOfDate(criteria.startDate),
          // 終了日はその日を含むので、翌日 0 時までを探す。
          timeMax: startOfDate(criteria.endDate) + DAY,
          preferences
        });
  if (unreadable.length > 0) {
    return { status: "unreadable", ids: unreadable };
  }
  return candidates.length > 0
    ? { status: "candidates", candidates }
    : { status: "none" };
}
