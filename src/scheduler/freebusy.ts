// =============================================================================
// scheduler/freebusy
// Google Calendar FreeBusy 照会。
// 返るのは「busy（埋まっている区間）」だけ。予定の中身（タイトル等）は取得しない。
// =============================================================================

import type { Interval } from "./types";

/** FreeBusy API のレスポンス（必要なフィールドのみ）。 */
export interface FreeBusyResponse {
  calendars?: Record<
    string,
    { busy?: { start: string; end: string }[]; errors?: unknown[] }
  >;
}

/** FreeBusy 照会の結果。読めなかったカレンダー ID は unreadable に分ける。 */
export interface FreeBusyResult {
  busy: Map<string, Interval[]>;
  unreadable: string[];
}

/**
 * FreeBusy レスポンスを busy 区間と「読めなかった ID」に振り分ける純粋関数。
 * errors を持つカレンダー（参照権限なし等）は throw せず unreadable に集める。
 */
export function parseFreeBusyResponse(data: FreeBusyResponse): FreeBusyResult {
  const busy = new Map<string, Interval[]>();
  const unreadable: string[] = [];
  for (const [id, cal] of Object.entries(data.calendars ?? {})) {
    if (cal.errors?.length) {
      unreadable.push(id);
      continue;
    }
    busy.set(
      id,
      (cal.busy ?? []).map((b) => ({
        start: Date.parse(b.start),
        end: Date.parse(b.end)
      }))
    );
  }
  return { busy, unreadable };
}

export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: number,
  timeMax: number,
  timeZone: string
): Promise<FreeBusyResult> {
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
  // 個々のカレンダーの errors（参照権限なし等）は throw せず unreadable に集める。
  return parseFreeBusyResponse((await res.json()) as FreeBusyResponse);
}
