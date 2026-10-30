// =============================================================================
// server/jev/draft.test
// Jev の答え → 調整条件の下書き（draftFromAnswers）の単体テスト。
// 答えは Jev の応答（answers）と同じ形で組み立てる。
// =============================================================================

import { describe, it, expect } from "vitest";
import { draftFromAnswers, type JevAnswers } from "./draft.ts";

const choice = (value: string, confidence = 1) => ({
  type: "choice" as const,
  choice: value,
  confidence
});
const noul = (p: number) => ({ type: "noul" as const, noul: p });

/** どの項目も「該当なし」・曜日指定なしの答え。各テストで必要な項目だけ上書きする。 */
function answers(overrides: Partial<JevAnswers> = {}): JevAnswers {
  return {
    kind: choice("unclear"),
    duration: choice("none"),
    frequency: choice("none"),
    occurrences: choice("none"),
    anchor: choice("none"),
    within_days: choice("none"),
    month: choice("none"),
    day: choice("none"),
    window: choice("none"),
    ...Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => [`wd${d}`, noul(0.02)])
    ),
    ...overrides
  };
}

// 2026-10-21 は水曜日。
const TODAY = "2026-10-21";

describe("draftFromAnswers", () => {
  it("「隔週1h、来月開始、午後」: 値を埋め、欠けた必須の回数だけ要確認にする", () => {
    const draft = draftFromAnswers(
      answers({
        kind: choice("recurring"),
        duration: choice("60"),
        frequency: choice("biweekly"),
        anchor: choice("next_month"),
        window: choice("afternoon")
      }),
      TODAY
    );
    expect(draft.criteria).toEqual({
      kind: "recurring",
      durationMinutes: 60,
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      everyNWeeks: 2,
      occurrences: null,
      weekdays: [1, 2, 3, 4, 5],
      preferredWindow: { startHour: 13, endHour: 17 }
    });
    expect(draft.review).toEqual(["occurrences"]);
    expect(draft.failed).toBe(false);
  });

  it("確からしさが閾値未満の項目は、値を残したまま要確認にする", () => {
    const draft = draftFromAnswers(
      answers({
        kind: choice("one_off", 0.62),
        duration: choice("45", 1),
        window: choice("morning", 0.5)
      }),
      TODAY
    );
    expect(draft.criteria).toMatchObject({
      kind: "one-off",
      durationMinutes: 45,
      preferredWindow: { startHour: 9, endHour: 12 }
    });
    expect(draft.review.sort()).toEqual(["kind", "preferredWindow"]);
  });

  it("単発のときは、定期だけの項目（頻度・回数）を要確認にしない", () => {
    const draft = draftFromAnswers(
      answers({
        kind: choice("one_off"),
        duration: choice("30"),
        frequency: choice("weekly", 0.59),
        occurrences: choice("2", 0.4)
      }),
      TODAY
    );
    expect(draft.review).toEqual([]);
  });

  it("既定ありの項目が「該当なし」なら既定値で埋め、要確認にはしない", () => {
    const draft = draftFromAnswers(answers({ duration: choice("30") }), TODAY);
    expect(draft.criteria).toEqual({
      kind: "one-off",
      durationMinutes: 30,
      startDate: TODAY,
      endDate: "2026-11-04",
      everyNWeeks: 1,
      occurrences: null,
      weekdays: [1, 2, 3, 4, 5],
      preferredWindow: null
    });
    expect(draft.review).toEqual([]);
    expect(draft.defaulted.sort()).toEqual(
      ["endDate", "everyNWeeks", "kind", "startDate", "weekdays"].sort()
    );
  });
});

describe("draftFromAnswers の期間", () => {
  /** 起点（と追加の答え）から [開始日, 終了日] を得る。 */
  function period(
    today: string,
    anchor: string,
    extra: Partial<JevAnswers> = {}
  ) {
    const { criteria } = draftFromAnswers(
      answers({ anchor: choice(anchor), ...extra }),
      today
    );
    return [criteria.startDate, criteria.endDate];
  }

  it.each([
    ["今日", "today", {}, ["2026-10-21", "2026-10-21"]],
    ["今週（今日〜日曜）", "this_week", {}, ["2026-10-21", "2026-10-25"]],
    ["来週（次の月曜〜日曜）", "next_week", {}, ["2026-10-26", "2026-11-01"]],
    ["今月（今日〜月末）", "this_month", {}, ["2026-10-21", "2026-10-31"]],
    [
      "N日以内",
      "within_days",
      { within_days: choice("7") },
      ["2026-10-21", "2026-10-28"]
    ],
    [
      "日付指定（その日から2週間）",
      "date",
      { month: choice("11"), day: choice("4") },
      ["2026-11-04", "2026-11-18"]
    ]
  ] as const)("%s", (_, anchor, extra, expected) => {
    expect(period(TODAY, anchor, extra)).toEqual(expected);
  });

  it("来月は年をまたぐ", () => {
    expect(period("2026-12-10", "next_month")).toEqual([
      "2027-01-01",
      "2027-01-31"
    ]);
  });

  it("今月の月末はうるう年の 2 月も正しい", () => {
    expect(period("2028-02-10", "this_month")).toEqual([
      "2028-02-10",
      "2028-02-29"
    ]);
  });

  it("日曜日の「来週」は翌日の月曜から", () => {
    expect(period("2026-10-25", "next_week")).toEqual([
      "2026-10-26",
      "2026-11-01"
    ]);
  });

  it("今日より前の日付指定は翌年とみなす", () => {
    expect(
      period(TODAY, "date", { month: choice("1"), day: choice("15") })
    ).toEqual(["2027-01-15", "2027-01-29"]);
  });

  it("日付指定なのに日が読めなければ、期間は既定値で要確認にする", () => {
    const draft = draftFromAnswers(
      answers({
        anchor: choice("date"),
        month: choice("11", 0.98),
        day: choice("none", 0.29)
      }),
      TODAY
    );
    expect(draft.criteria.startDate).toBe(TODAY);
    expect(draft.review).toEqual(
      expect.arrayContaining(["startDate", "endDate"])
    );
  });
});

describe("draftFromAnswers の曜日", () => {
  it("はっきり指定された曜日だけを選ぶ（火・木）", () => {
    const draft = draftFromAnswers(
      answers({ wd2: noul(0.96), wd4: noul(0.98) }),
      TODAY
    );
    expect(draft.criteria.weekdays).toEqual([2, 4]);
    expect(draft.review).not.toContain("weekdays");
    expect(draft.defaulted).not.toContain("weekdays");
  });

  it("どちらとも言えない曜日があれば要確認にする", () => {
    const draft = draftFromAnswers(
      answers({ wd2: noul(0.28), wd4: noul(0.95) }),
      TODAY
    );
    expect(draft.criteria.weekdays).toEqual([4]);
    expect(draft.review).toContain("weekdays");
  });
});
