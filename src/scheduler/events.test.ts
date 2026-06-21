import { describe, it, expect } from "vitest";
import { buildEventId, buildEventRequest } from "./events.ts";

const base = {
  organizer: "me@esm.co.jp",
  title: "打ち合わせ",
  startISO: "2026-06-23T04:00:00.000Z",
  endISO: "2026-06-23T05:00:00.000Z",
  attendees: ["a@esm.co.jp", "b@esm.co.jp"]
};

describe("buildEventId", () => {
  it("同じ予約からは同じ id（参加者の順序にも依存しない）", async () => {
    const id1 = await buildEventId(base);
    const id2 = await buildEventId({ ...base, attendees: [...base.attendees] });
    const reordered = await buildEventId({
      ...base,
      attendees: ["b@esm.co.jp", "a@esm.co.jp"]
    });
    expect(id1).toBe(id2);
    expect(reordered).toBe(id1);
  });

  it("予約の差分（タイトル/開始/終了/参加者/繰り返し）で別 id になる", async () => {
    const id1 = await buildEventId(base);
    expect(await buildEventId({ ...base, title: "別の会議" })).not.toBe(id1);
    expect(
      await buildEventId({ ...base, startISO: "2026-06-23T05:00:00.000Z" })
    ).not.toBe(id1);
    expect(
      await buildEventId({ ...base, endISO: "2026-06-23T06:00:00.000Z" })
    ).not.toBe(id1);
    expect(
      await buildEventId({ ...base, attendees: ["a@esm.co.jp", "c@esm.co.jp"] })
    ).not.toBe(id1);
    expect(
      await buildEventId({
        ...base,
        recurrence: { everyNWeeks: 2, occurrences: 6 }
      })
    ).not.toBe(id1);
  });

  it("Google event id の制約（base32hex の文字集合・長さ）を満たす", async () => {
    const id = await buildEventId(base);
    expect(id).toMatch(/^[0-9a-v]+$/);
    expect(id.length).toBeGreaterThanOrEqual(5);
    expect(id.length).toBeLessThanOrEqual(1024);
  });
});

describe("buildEventRequest", () => {
  it("基本フィールドを events.insert ボディにマッピングする", () => {
    const body = buildEventRequest(
      { ...base, timeZone: "Asia/Tokyo" },
      "evt123"
    );
    expect(body.id).toBe("evt123");
    expect(body.summary).toBe("打ち合わせ");
    expect(body.start).toEqual({
      dateTime: base.startISO,
      timeZone: "Asia/Tokyo"
    });
    expect(body.end.dateTime).toBe(base.endISO);
    expect(body.attendees).toEqual([
      { email: "a@esm.co.jp" },
      { email: "b@esm.co.jp" }
    ]);
  });

  it("addMeet で conferenceData を出し分ける", () => {
    expect(
      buildEventRequest({ ...base, addMeet: true }, "evtM").conferenceData
    ).toBeTruthy();
    expect(
      buildEventRequest({ ...base, addMeet: false }, "evtN").conferenceData
    ).toBeUndefined();
  });

  it("定例は繰り返し(RRULE)で1イベントにする", () => {
    const recurring = buildEventRequest(
      { ...base, recurrence: { everyNWeeks: 2, occurrences: 6 } },
      "evtR"
    );
    expect(recurring.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6"
    ]);
    expect(buildEventRequest(base, "evtS").recurrence).toBeUndefined();
  });
});
