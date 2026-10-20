// =============================================================================
// server/api/events
// 予約確定（POST /api/events）。人が候補を選んで予約ボタンを押したこと
// そのものを承認とみなし、主催者（本人）のカレンダーに予定を作って招待を送る。
// =============================================================================

import { createEvent } from "../../scheduler";
import {
  defaultTitle,
  type BookingRequest,
  type Participant
} from "../../shared/booking";

/** 調整さまは日本時間固定で扱う。 */
const TIME_ZONE = "Asia/Tokyo";

export async function bookEvent(
  accessToken: string,
  organizer: Participant,
  req: BookingRequest
): Promise<{ htmlLink?: string; alreadyExists: boolean }> {
  const start = Date.parse(req.startISO);
  const result = await createEvent(accessToken, {
    organizer: organizer.email,
    title: defaultTitle(organizer, req.participants),
    startISO: new Date(start).toISOString(),
    endISO: new Date(start + req.durationMinutes * 60_000).toISOString(),
    // 主催者は作成先カレンダーの所有者なので招待には含めない。
    attendees: req.participants
      .map((p) => p.email)
      .filter((email) => email !== organizer.email),
    timeZone: TIME_ZONE,
    addMeet: true,
    // 定期は Google の繰り返し（RRULE）で 1 つの予定として作る。
    recurrence: req.recurrence
  });
  return { htmlLink: result.htmlLink, alreadyExists: result.alreadyExists };
}
