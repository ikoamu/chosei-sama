import { describe, it, expect } from "vitest";
import {
  mergeIntervals,
  subtractIntervals,
  workingWindowsInRange,
  commonFree,
  findSlots
} from "./index.ts";
import type { Interval, SlotPreferences } from "./types.ts";

const H = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

describe("mergeIntervals", () => {
  it("重複・隣接する区間をまとめる", () => {
    const merged = mergeIntervals([
      { start: 10, end: 20 },
      { start: 15, end: 25 }, // overlap -> merge
      { start: 25, end: 30 }, // adjacent -> merge
      { start: 40, end: 50 } // separate
    ]);
    expect(merged).toEqual([
      { start: 10, end: 30 },
      { start: 40, end: 50 }
    ]);
  });
});

describe("subtractIntervals", () => {
  it("busy を差し引いた空き区間を返す", () => {
    const free = subtractIntervals({ start: 0, end: 100 }, [
      { start: 20, end: 30 },
      { start: 50, end: 60 }
    ]);
    expect(free).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 }
    ]);
  });
});

describe("workingWindowsInRange (Asia/Tokyo)", () => {
  it("平日は 9:00-18:00 JST の1ウィンドウになる", () => {
    const prefs: SlotPreferences = {
      durationMinutes: 30,
      timeZone: "Asia/Tokyo",
      workingHours: { startHour: 9, endHour: 18 }
    };
    // 2025-07-07(月) 00:00 JST .. 2025-07-08(火) 00:00 JST
    const w = workingWindowsInRange(
      H("2025-07-06T15:00:00.000Z"),
      H("2025-07-07T15:00:00.000Z"),
      prefs
    );
    expect(w).toHaveLength(1);
    expect(iso(w[0].start)).toBe("2025-07-07T00:00:00.000Z"); // 09:00 JST
    expect(iso(w[0].end)).toBe("2025-07-07T09:00:00.000Z"); // 18:00 JST
  });

  it("週末は除外される", () => {
    const prefs: SlotPreferences = {
      durationMinutes: 30,
      timeZone: "Asia/Tokyo"
    };
    // 2025-07-05(土) .. 2025-07-06(日)
    const w = workingWindowsInRange(
      H("2025-07-04T15:00:00.000Z"),
      H("2025-07-06T15:00:00.000Z"),
      prefs
    );
    expect(w).toHaveLength(0);
  });

  it("allowedWeekdays で曜日を絞れる（金曜のみ）", () => {
    const prefs: SlotPreferences = {
      durationMinutes: 30,
      timeZone: "Asia/Tokyo",
      allowedWeekdays: [5]
    };
    // 2026-06-22(月) .. 2026-06-28(日) を覆う
    const w = workingWindowsInRange(
      H("2026-06-21T15:00:00.000Z"),
      H("2026-06-27T15:00:00.000Z"),
      prefs
    );
    expect(w).toHaveLength(1);
    // 金曜 09:00 JST = 00:00 UTC（= 2026-06-26）
    expect(iso(w[0].start)).toBe("2026-06-26T00:00:00.000Z");
  });
});

describe("commonFree + findSlots（午後優先）", () => {
  const prefs: SlotPreferences = {
    durationMinutes: 30,
    timeZone: "Asia/Tokyo",
    workingHours: { startHour: 9, endHour: 18 },
    granularityMinutes: 30,
    preferredWindow: { startHour: 13, endHour: 17 },
    maxResults: 20
  };
  const tMin = H("2025-07-06T15:00:00.000Z"); // 07-07 00:00 JST(月)
  const tMax = H("2025-07-07T15:00:00.000Z");
  // A: 10:00-12:00 JST / B: 13:00-13:30 JST
  const aBusy: Interval[] = [
    { start: H("2025-07-07T01:00:00Z"), end: H("2025-07-07T03:00:00Z") }
  ];
  const bBusy: Interval[] = [
    { start: H("2025-07-07T04:00:00Z"), end: H("2025-07-07T04:30:00Z") }
  ];
  const windows = workingWindowsInRange(tMin, tMax, prefs);
  const free = commonFree([aBusy, bBusy], windows);

  it("全員の空きは 09-10 / 12-13 / 13:30-18 (JST) の3帯", () => {
    expect(free).toHaveLength(3);
  });

  it("トップ候補は午後の先頭 13:30 JST・30分・スコア100", () => {
    const slots = findSlots(free, prefs);
    expect(slots[0].startISO).toBe("2025-07-07T04:30:00.000Z"); // 13:30 JST
    expect(slots[0].endISO).toBe("2025-07-07T05:00:00.000Z"); // 14:00 JST
    expect(slots[0].score).toBe(100);
  });
});
