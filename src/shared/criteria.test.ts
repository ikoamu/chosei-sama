// =============================================================================
// shared/criteria.test
// 調整条件のフォーム規則（既定値・必須項目）の単体テスト。
// =============================================================================

import { describe, it, expect } from "vitest";
import { defaultCriteria, missingRequired } from "./criteria.ts";

describe("defaultCriteria", () => {
  it("既定値は 今日〜2週間後・単発・毎週・平日 で、必須項目は空", () => {
    expect(defaultCriteria("2026-10-20")).toEqual({
      kind: "one-off",
      durationMinutes: null,
      startDate: "2026-10-20",
      endDate: "2026-11-03",
      everyNWeeks: 1,
      occurrences: null,
      weekdays: [1, 2, 3, 4, 5],
      preferredWindow: null
    });
  });
});

describe("missingRequired", () => {
  const base = defaultCriteria("2026-10-20");

  it("単発は所要時間が空なら欠落、埋まっていれば欠落なし", () => {
    expect(missingRequired(base)).toEqual(["durationMinutes"]);
    expect(missingRequired({ ...base, durationMinutes: 30 })).toEqual([]);
  });

  it("定期は回数も必須", () => {
    const recurring = { ...base, kind: "recurring" as const };
    expect(missingRequired(recurring)).toEqual([
      "durationMinutes",
      "occurrences"
    ]);
    expect(
      missingRequired({ ...recurring, durationMinutes: 60, occurrences: 6 })
    ).toEqual([]);
  });
});
