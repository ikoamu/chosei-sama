// =============================================================================
// scheduler/freebusy
// Google Calendar FreeBusy 照会。
// 返るのは「busy（埋まっている区間）」だけ。予定の中身（タイトル等）は取得しない。
// =============================================================================

import type { Interval } from "./types";

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
