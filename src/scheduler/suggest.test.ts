// =============================================================================
// scheduler/suggest.test
// オーケストレーション層（suggestSlots / suggestRecurringSlots）の単体テスト。
// FreeBusy 照会（queryFreeBusy）はモックし、区間演算との合成・unreadable 短絡・
// 勤務時間/刻み/buffer/preferredWindow/定期の全オカレンス検証を確かめる。
// タイムゾーンは DST の無い Asia/Tokyo（常に +09:00）で決定的にする。
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { suggestSlots, suggestRecurringSlots } from "./suggest.ts";
import { queryFreeBusy } from "./freebusy.ts";
import type { Interval, SlotPreferences } from "./types.ts";

vi.mock("./freebusy.ts", () => ({ queryFreeBusy: vi.fn() }));
const mockQuery = vi.mocked(queryFreeBusy);

const TZ = "Asia/Tokyo";
/** +09:00 を含む ISO 文字列を epoch ms に。 */
const at = (iso: string) => Date.parse(iso);

/** queryFreeBusy の戻り（busy マップ / unreadable）を差し替える。 */
function freeBusy(busy: Record<string, Interval[]>, unreadable: string[] = []) {
  mockQuery.mockResolvedValue({
    busy: new Map(Object.entries(busy)),
    unreadable
  });
}

// 月曜 2026-01-05（JST）の 1 日ぶんの探索期間。
const MON_MIN = at("2026-01-05T00:00:00+09:00");
const MON_MAX = at("2026-01-06T00:00:00+09:00");

const basePrefs: SlotPreferences = {
  durationMinutes: 60,
  timeZone: TZ,
  granularityMinutes: 60,
  maxResults: 20
};

/** 月曜 1 日ぶんの範囲で suggestSlots を呼ぶ薄いラッパ。 */
function runSuggest(
  preferences: SlotPreferences,
  calendarIds = ["me@example.com"]
) {
  return suggestSlots({
    accessToken: "t",
    calendarIds,
    timeMin: MON_MIN,
    timeMax: MON_MAX,
    preferences
  });
}

/** 1 区間だけ busy を持つ参加者を作るヘルパー。 */
function busyAt(startISO: string, endISO: string): Record<string, Interval[]> {
  return { "me@example.com": [{ start: at(startISO), end: at(endISO) }] };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("suggestSlots", () => {
  it("読めない参加者がいたら候補を出さず unreadable を返す", async () => {
    freeBusy({}, ["alice@example.com"]);
    const r = await runSuggest(basePrefs, [
      "me@example.com",
      "alice@example.com"
    ]);
    expect(r.unreadable).toEqual(["alice@example.com"]);
    expect(r.candidates).toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("全員空きなら勤務時間内の候補を刻みごとに返す", async () => {
    freeBusy({ "me@example.com": [], "bob@example.com": [] });
    const r = await runSuggest(basePrefs, [
      "me@example.com",
      "bob@example.com"
    ]);
    // 月 09:00-18:00 JST、60 分・60 分刻み → 09:00…17:00 の 9 件。
    expect(r.unreadable).toEqual([]);
    expect(r.candidates).toHaveLength(9);
    expect(r.candidates[0].startISO).toBe("2026-01-05T00:00:00.000Z"); // 09:00 JST
    expect(r.candidates.at(-1)!.startISO).toBe("2026-01-05T08:00:00.000Z"); // 17:00 JST
    for (const c of r.candidates) {
      expect(c.end - c.start).toBe(60 * 60_000);
    }
  });

  it("busy 区間に重なる候補は除外する", async () => {
    freeBusy(busyAt("2026-01-05T10:00:00+09:00", "2026-01-05T11:00:00+09:00"));
    const r = await runSuggest(basePrefs);
    const starts = r.candidates.map((c) => c.startISO);
    expect(starts).not.toContain("2026-01-05T01:00:00.000Z"); // 10:00 JST
    expect(r.candidates).toHaveLength(8);
  });

  it("bufferMinutes は busy の前後を広げて除外する", async () => {
    freeBusy(busyAt("2026-01-05T10:00:00+09:00", "2026-01-05T11:00:00+09:00"));
    const r = await runSuggest({ ...basePrefs, bufferMinutes: 30 });
    // 09:30-11:30 が塞がり、60 分刻みでは 12:00 が最初の候補。
    expect(r.candidates[0].startISO).toBe("2026-01-05T03:00:00.000Z"); // 12:00 JST
    expect(r.candidates.map((c) => c.startISO)).not.toContain(
      "2026-01-05T00:00:00.000Z" // 09:00 JST はバッファで消える
    );
  });

  it("preferredWindow の候補を上位にし maxResults で打ち切る", async () => {
    freeBusy({ "me@example.com": [] });
    const r = await runSuggest({
      ...basePrefs,
      preferredWindow: { startHour: 13, endHour: 17 },
      maxResults: 3
    });
    expect(r.candidates).toHaveLength(3);
    expect(r.candidates.map((c) => c.startISO)).toEqual([
      "2026-01-05T04:00:00.000Z", // 13:00 JST
      "2026-01-05T05:00:00.000Z", // 14:00 JST
      "2026-01-05T06:00:00.000Z" // 15:00 JST
    ]);
    expect(r.candidates.every((c) => c.score === 100)).toBe(true);
  });
});

describe("suggestRecurringSlots", () => {
  const recPrefs: SlotPreferences = {
    durationMinutes: 60,
    timeZone: TZ,
    workingHours: { startHour: 9, endHour: 11 }, // 候補時刻を 09:00 / 10:00 に絞る
    allowedWeekdays: [1], // 月曜のみ
    granularityMinutes: 60,
    maxResults: 10
  };

  it("読めない参加者がいたら候補を出さない", async () => {
    freeBusy({}, ["x@example.com"]);
    const r = await suggestRecurringSlots({
      accessToken: "t",
      calendarIds: ["me@example.com", "x@example.com"],
      firstDate: MON_MIN,
      occurrences: 2,
      everyNWeeks: 1,
      preferences: recPrefs
    });
    expect(r).toEqual({ candidates: [], unreadable: ["x@example.com"] });
  });

  it("全オカレンスで空く曜日×時刻だけ返す", async () => {
    freeBusy({ "me@example.com": [] });
    const r = await suggestRecurringSlots({
      accessToken: "t",
      calendarIds: ["me@example.com"],
      firstDate: MON_MIN,
      occurrences: 2,
      everyNWeeks: 1,
      preferences: recPrefs
    });
    expect(r.candidates).toHaveLength(2);
    expect(r.candidates.map((c) => c.localTime).sort()).toEqual([
      "09:00",
      "10:00"
    ]);
    for (const c of r.candidates) {
      expect(c.weekday).toBe(1);
      expect(c.occurrenceStartsISO).toHaveLength(2);
    }
    const nine = r.candidates.find((c) => c.localTime === "09:00")!;
    expect(nine.startISOFirst).toBe("2026-01-05T00:00:00.000Z"); // 初回 09:00 JST
    expect(nine.occurrenceStartsISO).toEqual([
      "2026-01-05T00:00:00.000Z", // 1 回目（月 01-05）
      "2026-01-12T00:00:00.000Z" // 2 回目（月 01-12）
    ]);
  });

  it("1 回でも埋まっている時刻は候補から外す", async () => {
    // 2 回目（01-12）の 09:00-10:00 だけ busy にする。
    freeBusy(busyAt("2026-01-12T09:00:00+09:00", "2026-01-12T10:00:00+09:00"));
    const r = await suggestRecurringSlots({
      accessToken: "t",
      calendarIds: ["me@example.com"],
      firstDate: MON_MIN,
      occurrences: 2,
      everyNWeeks: 1,
      preferences: recPrefs
    });
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].localTime).toBe("10:00");
  });
});
