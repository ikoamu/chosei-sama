import { describe, it, expect } from "vitest";
import { parseFreeBusyResponse } from "./freebusy.ts";

const H = (iso: string) => Date.parse(iso);

describe("parseFreeBusyResponse", () => {
  it("busy 区間を epoch ms で抽出し、読めない人はいない", () => {
    const { busy, unreadable } = parseFreeBusyResponse({
      calendars: {
        "a@esm.co.jp": {
          busy: [{ start: "2026-06-18T01:00:00Z", end: "2026-06-18T02:00:00Z" }]
        }
      }
    });
    expect(busy.get("a@esm.co.jp")).toEqual([
      { start: H("2026-06-18T01:00:00Z"), end: H("2026-06-18T02:00:00Z") }
    ]);
    expect(unreadable).toEqual([]);
  });

  it("errors を持つ参加者は throw せず unreadable に振り分ける", () => {
    const { busy, unreadable } = parseFreeBusyResponse({
      calendars: {
        "ok@esm.co.jp": { busy: [] },
        "hidden@esm.co.jp": {
          errors: [{ domain: "global", reason: "notFound" }]
        }
      }
    });
    expect(busy.has("ok@esm.co.jp")).toBe(true);
    expect(busy.has("hidden@esm.co.jp")).toBe(false);
    expect(unreadable).toEqual(["hidden@esm.co.jp"]);
  });
});
