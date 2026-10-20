// =============================================================================
// client/lib/suggest
// 候補提案 API（POST /api/suggest）・予約確定 API（POST /api/events）の呼び出しと、
// 日付まわりの表示ヘルパー。
// =============================================================================

import type { SchedulingCriteria, SuggestResult } from "../../shared/criteria";
import type { BookingRequest } from "../../shared/booking";

/** 調整さまは日本時間固定で扱う。 */
const TIME_ZONE = "Asia/Tokyo";

/** TIME_ZONE における今日（YYYY-MM-DD）。 */
export function todayInTimeZone(): string {
  // en-CA ロケールは YYYY-MM-DD 形式で出力する。
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date()
  );
}

/** ISO 時刻を「1/5(月) 17:30」のように TIME_ZONE で表示する。 */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

/** ISO 時刻の時:分だけを TIME_ZONE で表示する。 */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export async function requestSuggest(
  members: string[],
  criteria: SchedulingCriteria
): Promise<SuggestResult> {
  const res = await fetch("/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ members, criteria })
  });
  if (!res.ok) {
    throw new Error(`候補の取得に失敗しました（${res.status}）`);
  }
  return (await res.json()) as SuggestResult;
}

export async function requestBooking(
  req: BookingRequest
): Promise<{ htmlLink?: string; alreadyExists: boolean }> {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    throw new Error(`予約に失敗しました（${res.status}）`);
  }
  return (await res.json()) as { htmlLink?: string; alreadyExists: boolean };
}
