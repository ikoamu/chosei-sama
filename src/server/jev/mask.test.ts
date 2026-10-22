// =============================================================================
// server/jev/mask.test
// Jev へ送る前の伏せ字処理の単体テスト。
// =============================================================================

import { describe, it, expect } from "vitest";
import { maskEmails } from "./mask.ts";

describe("maskEmails", () => {
  it("メールアドレスらしき文字列を伏せ、ほかの文はそのまま残す", () => {
    expect(maskEmails("tanaka.taro+mtg@example.co.jp と30分、b@x.io も")).toBe(
      "[メール] と30分、[メール] も"
    );
  });
});
