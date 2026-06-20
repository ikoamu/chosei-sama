import { buildEventId, buildEventRequest } from "./events.ts";

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

const base = {
  organizer: "me@esm.co.jp",
  title: "打ち合わせ",
  startISO: "2026-06-23T04:00:00.000Z",
  endISO: "2026-06-23T05:00:00.000Z",
  attendees: ["a@esm.co.jp", "b@esm.co.jp"]
};

await (async () => {
  // --- 決定的: 同じ入力 → 同じ id ---------------------------------------------
  const id1 = await buildEventId(base);
  const id2 = await buildEventId({ ...base, attendees: [...base.attendees] });
  check("決定的: 同入力で同じ id", id1 === id2, `${id1} vs ${id2}`);

  // --- 参加者の順序に依存しない -----------------------------------------------
  const reordered = await buildEventId({
    ...base,
    attendees: ["b@esm.co.jp", "a@esm.co.jp"]
  });
  check("順序非依存: 参加者を並べ替えても同じ id", reordered === id1);

  // --- 異なる予約 → 異なる id -------------------------------------------------
  const otherTitle = await buildEventId({ ...base, title: "別の会議" });
  const otherStart = await buildEventId({
    ...base,
    startISO: "2026-06-23T05:00:00.000Z"
  });
  const otherAttendee = await buildEventId({
    ...base,
    attendees: ["a@esm.co.jp", "c@esm.co.jp"]
  });
  const otherEnd = await buildEventId({
    ...base,
    endISO: "2026-06-23T06:00:00.000Z"
  });
  check("差分: タイトル違いは別 id", otherTitle !== id1);
  check("差分: 開始時刻違いは別 id", otherStart !== id1);
  check("差分: 終了時刻（所要時間）違いは別 id", otherEnd !== id1);
  check("差分: 参加者違いは別 id", otherAttendee !== id1);

  // --- Google event id 制約（base32hex / 長さ）------------------------------
  check("制約: 文字集合は 0-9a-v", /^[0-9a-v]+$/.test(id1), id1);
  check("制約: 長さ 5-1024", id1.length >= 5 && id1.length <= 1024, id1);

  // --- buildEventRequest: 基本マッピング -------------------------------------
  {
    const body = buildEventRequest(
      { ...base, timeZone: "Asia/Tokyo" },
      "evt123"
    );
    check("body: id を含む", body.id === "evt123");
    check("body: summary=タイトル", body.summary === "打ち合わせ");
    check(
      "body: start dateTime/timeZone",
      body.start.dateTime === base.startISO &&
        body.start.timeZone === "Asia/Tokyo"
    );
    check("body: end dateTime", body.end.dateTime === base.endISO);
    check(
      "body: attendees は {email} 配列",
      body.attendees?.length === 2 && body.attendees[0].email === "a@esm.co.jp",
      JSON.stringify(body.attendees)
    );
  }

  // --- buildEventRequest: Meet on/off ----------------------------------------
  {
    const withMeet = buildEventRequest({ ...base, addMeet: true }, "evtM");
    check(
      "Meet: addMeet true で conferenceData あり",
      !!withMeet.conferenceData
    );
    const noMeet = buildEventRequest({ ...base, addMeet: false }, "evtN");
    check("Meet: addMeet false で conferenceData なし", !noMeet.conferenceData);
  }

  // --- buildEventRequest: 定例は繰り返し(RRULE)で1イベントに -----------------
  {
    const recurring = buildEventRequest(
      { ...base, recurrence: { everyNWeeks: 2, occurrences: 6 } },
      "evtR"
    );
    check(
      "繰り返し: RRULE で隔週6回",
      recurring.recurrence?.[0] === "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6",
      JSON.stringify(recurring.recurrence)
    );
    const single = buildEventRequest(base, "evtS");
    check("単発: recurrence なし", !single.recurrence);
  }

  // --- buildEventId: 定例と単発で別 id ---------------------------------------
  {
    const recurringId = await buildEventId({
      ...base,
      recurrence: { everyNWeeks: 2, occurrences: 6 }
    });
    check("差分: 繰り返し有無で別 id", recurringId !== id1);
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    process.exit(1);
  }
})();
