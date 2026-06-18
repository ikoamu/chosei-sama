import { parseFreeBusyResponse } from "./freebusy.ts";

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

// --- 通常の busy 区間を抽出 -------------------------------------------------
{
  const { busy, unreadable } = parseFreeBusyResponse({
    calendars: {
      "a@esm.co.jp": {
        busy: [{ start: "2026-06-18T01:00:00Z", end: "2026-06-18T02:00:00Z" }]
      }
    }
  });
  const a = busy.get("a@esm.co.jp");
  check("busy: 区間が epoch ms で取れる", a?.length === 1, JSON.stringify(a));
  check(
    "busy: start/end が一致",
    a?.[0].start === H("2026-06-18T01:00:00Z") &&
      a?.[0].end === H("2026-06-18T02:00:00Z")
  );
  check("busy: 読めない人はいない", unreadable.length === 0);
}

// --- errors を持つ参加者は unreadable に振り分け（throw しない）-------------
{
  const { busy, unreadable } = parseFreeBusyResponse({
    calendars: {
      "ok@esm.co.jp": { busy: [] },
      "hidden@esm.co.jp": {
        errors: [{ domain: "global", reason: "notFound" }]
      }
    }
  });
  check("混在: 読める人は busy に", busy.has("ok@esm.co.jp"));
  check("混在: 読めない人は busy に入れない", !busy.has("hidden@esm.co.jp"));
  check(
    "混在: 読めない人を unreadable で名指し",
    unreadable.length === 1 && unreadable[0] === "hidden@esm.co.jp",
    JSON.stringify(unreadable)
  );
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  process.exit(1);
}
