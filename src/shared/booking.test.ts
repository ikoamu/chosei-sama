// =============================================================================
// shared/booking.test
// 予約確定の既定タイトルの単体テスト。
// =============================================================================

import { describe, it, expect } from "vitest";
import { defaultTitle } from "./booking.ts";

describe("defaultTitle", () => {
  it("主催者（自分）を先頭に、参加者名を並べた決まった形になる", () => {
    expect(
      defaultTitle({ email: "me@example.com", name: "自分" }, [
        { email: "a@example.com", name: "A" },
        { email: "me@example.com", name: "自分" },
        { email: "b@example.com", name: "B" }
      ])
    ).toBe("打ち合わせ（自分・A・B）");
  });
});
