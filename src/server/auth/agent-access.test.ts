import { describe, it, expect } from "vitest";
import { isOwnAgentPath } from "./agent-access.ts";

const me = "shotaro.aoki@esm.co.jp";

describe("isOwnAgentPath", () => {
  it("自分のメール名なら許可", () => {
    expect(
      isOwnAgentPath("/agents/chat-agent/shotaro.aoki@esm.co.jp", me)
    ).toBe(true);
  });

  it("別メール名は拒否", () => {
    expect(isOwnAgentPath("/agents/chat-agent/victim@esm.co.jp", me)).toBe(
      false
    );
  });

  it("%40 をデコードして一致", () => {
    expect(
      isOwnAgentPath("/agents/chat-agent/shotaro.aoki%40esm.co.jp", me)
    ).toBe(true);
  });

  it("メールの大文字小文字は無視", () => {
    expect(
      isOwnAgentPath("/agents/chat-agent/Shotaro.Aoki@ESM.co.jp", me)
    ).toBe(true);
  });

  it("RPC など後続パスがあってもインスタンス名で判定（自分）", () => {
    expect(
      isOwnAgentPath("/agents/chat-agent/shotaro.aoki@esm.co.jp/call/foo", me)
    ).toBe(true);
  });

  it("後続パスがあっても他人なら拒否", () => {
    expect(
      isOwnAgentPath("/agents/chat-agent/victim@esm.co.jp/call/foo", me)
    ).toBe(false);
  });

  it("インスタンス名が無いパスは委ねる（許可）", () => {
    expect(isOwnAgentPath("/agents/chat-agent", me)).toBe(true);
  });
});
