import {
  mergeIntervals,
  subtractIntervals,
  workingWindowsInRange,
  commonFree,
  findSlots,
  type Interval,
  type SlotPreferences
} from "./scheduler-core.ts";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ok  - ${name}`);
  } else {
    fail++;
    console.log(`  XX  - ${name}  ${extra}`);
  }
}

const H = (iso: string) => Date.parse(iso);

// --- mergeIntervals ---------------------------------------------------------
{
  const merged = mergeIntervals([
    { start: 10, end: 20 },
    { start: 15, end: 25 }, // overlap -> merge
    { start: 25, end: 30 }, // adjacent -> merge
    { start: 40, end: 50 } // separate
  ]);
  check("merge: 4区間が2区間に", merged.length === 2, JSON.stringify(merged));
  check("merge: 1つ目 10-30", merged[0].start === 10 && merged[0].end === 30);
  check("merge: 2つ目 40-50", merged[1].start === 40 && merged[1].end === 50);
}

// --- subtractIntervals ------------------------------------------------------
{
  const free = subtractIntervals({ start: 0, end: 100 }, [
    { start: 20, end: 30 },
    { start: 50, end: 60 }
  ]);
  check("subtract: 3つの空きが残る", free.length === 3, JSON.stringify(free));
  check(
    "subtract: 0-20 / 30-50 / 60-100",
    free[0].start === 0 &&
      free[0].end === 20 &&
      free[1].start === 30 &&
      free[1].end === 50 &&
      free[2].start === 60 &&
      free[2].end === 100
  );
}

// --- workingWindowsInRange (Asia/Tokyo) -------------------------------------
{
  const prefs: SlotPreferences = {
    durationMinutes: 30,
    timeZone: "Asia/Tokyo",
    workingHours: { startHour: 9, endHour: 18 }
  };
  // 2025-07-07(月) 00:00 JST .. 2025-07-08(火) 00:00 JST を覆う範囲
  const tMin = H("2025-07-06T15:00:00.000Z"); // = 07-07 00:00 JST
  const tMax = H("2025-07-07T15:00:00.000Z"); // = 07-08 00:00 JST
  const w = workingWindowsInRange(tMin, tMax, prefs);
  check("working: 平日は1ウィンドウ", w.length === 1, JSON.stringify(w));
  // 9:00 JST = 00:00 UTC, 18:00 JST = 09:00 UTC
  check(
    "working: 09:00 JST = 00:00 UTC",
    new Date(w[0].start).toISOString() === "2025-07-07T00:00:00.000Z",
    new Date(w[0].start).toISOString()
  );
  check(
    "working: 18:00 JST = 09:00 UTC",
    new Date(w[0].end).toISOString() === "2025-07-07T09:00:00.000Z",
    new Date(w[0].end).toISOString()
  );
}

// --- 週末は除外される -------------------------------------------------------
{
  const prefs: SlotPreferences = {
    durationMinutes: 30,
    timeZone: "Asia/Tokyo"
  };
  // 2025-07-05(土) 00:00 JST .. 2025-07-06(日) 24:00 JST 付近
  const tMin = H("2025-07-04T15:00:00.000Z"); // 07-05 00:00 JST (土)
  const tMax = H("2025-07-06T15:00:00.000Z"); // 07-07 00:00 JST (月直前)
  const w = workingWindowsInRange(tMin, tMax, prefs);
  check("working: 週末は0ウィンドウ", w.length === 0, JSON.stringify(w));
}

// --- 統合: commonFree + findSlots（午後優先） -------------------------------
{
  const prefs: SlotPreferences = {
    durationMinutes: 30,
    timeZone: "Asia/Tokyo",
    workingHours: { startHour: 9, endHour: 18 },
    granularityMinutes: 30,
    preferredWindow: { startHour: 13, endHour: 17 }, // 午後優先
    maxResults: 20
  };
  const tMin = H("2025-07-06T15:00:00.000Z"); // 07-07 00:00 JST(月)
  const tMax = H("2025-07-07T15:00:00.000Z");

  // A: 10:00-12:00 JST = 01:00-03:00 UTC
  const aBusy: Interval[] = [
    { start: H("2025-07-07T01:00:00Z"), end: H("2025-07-07T03:00:00Z") }
  ];
  // B: 13:00-13:30 JST = 04:00-04:30 UTC
  const bBusy: Interval[] = [
    { start: H("2025-07-07T04:00:00Z"), end: H("2025-07-07T04:30:00Z") }
  ];

  const windows = workingWindowsInRange(tMin, tMax, prefs);
  const free = commonFree([aBusy, bBusy], windows);
  // 期待: 09-10, 12-13, 13:30-18 (JST)
  check(
    "common: 3つの空き帯",
    free.length === 3,
    JSON.stringify(
      free.map((f) => [
        new Date(f.start).toISOString(),
        new Date(f.end).toISOString()
      ])
    )
  );

  const slots = findSlots(free, prefs);
  // 最有力は午後の先頭 13:30 JST = 04:30 UTC
  check(
    "slots: トップ候補は 13:30 JST(04:30 UTC)",
    slots[0].startISO === "2025-07-07T04:30:00.000Z",
    slots[0].startISO
  );
  // 30分枠なので 13:30-14:00 JST
  check(
    "slots: トップ候補の終了は 14:00 JST(05:00 UTC)",
    slots[0].endISO === "2025-07-07T05:00:00.000Z",
    slots[0].endISO
  );
  // 午後枠はスコア100、午前枠は0
  check(
    "slots: 午後枠が高スコア",
    slots[0].score === 100,
    String(slots[0].score)
  );
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  process.exit(1);
}
