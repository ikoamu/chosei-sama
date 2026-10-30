// =============================================================================
// server/api/events.test
// 予約確定 API（POST /api/events）の振る舞いテスト。
// Request を組み立てて handleApiRoute を直接呼び、外部（Google の token /
// events.insert エンドポイント）だけを fetch のモックで差し替える。
// =============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { handleApiRoute } from "./index.ts";
import { apiRequest, env, sessionCookie, stubGoogle } from "./testing.ts";
import type { BookingRequest } from "../../shared/booking.ts";

const booking: BookingRequest = {
  participants: [
    { email: "me@example.com", name: "自分" },
    { email: "a@example.com", name: "A" }
  ],
  startISO: "2026-01-05T08:30:00.000Z",
  durationMinutes: 30
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/events", () => {
  it("未ログインなら 401 で、カレンダーには書き込まない", async () => {
    const google = stubGoogle();
    const res = await handleApiRoute(apiRequest("/api/events", booking), env);
    expect(res.status).toBe(401);
    expect(google.insertedEvents()).toEqual([]);
  });

  it("単発: 既定タイトル・自分を除いた招待・開始＋所要時間の終了で作り、リンクを返す", async () => {
    const google = stubGoogle();
    const res = await handleApiRoute(
      apiRequest("/api/events", booking, await sessionCookie()),
      env
    );
    expect(res.status).toBe(200);
    const [event] = google.insertedEvents();
    expect(event).toMatchObject({
      summary: "打ち合わせ（自分・A）",
      start: { dateTime: "2026-01-05T08:30:00.000Z" },
      end: { dateTime: "2026-01-05T09:00:00.000Z" },
      attendees: [{ email: "a@example.com" }]
    });
    expect(event.recurrence).toBeUndefined();
    expect(await res.json()).toEqual({
      htmlLink: `https://calendar.google.com/event?eid=${event.id}`,
      alreadyExists: false
    });
  });

  it("定期: 初回の開始時刻から、繰り返しルール付きの 1 件の予定として作る", async () => {
    const google = stubGoogle();
    await handleApiRoute(
      apiRequest(
        "/api/events",
        { ...booking, recurrence: { everyNWeeks: 2, occurrences: 6 } },
        await sessionCookie()
      ),
      env
    );
    const events = google.insertedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6"
    ]);
  });
});
