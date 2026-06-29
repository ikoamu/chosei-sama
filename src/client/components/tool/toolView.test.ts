// =============================================================================
// toolView の単体テスト。状態 → 表示種別の振り分けを検証する。
// =============================================================================

import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { toolViewKind } from "./toolView";

type Part = UIMessage["parts"][number];

/** テスト用のツールパートを最小構成で作る。 */
function toolPart(overrides: Record<string, unknown>): Part {
  return {
    type: "tool-suggestSlots",
    toolCallId: "call-1",
    ...overrides
  } as unknown as Part;
}

describe("toolViewKind", () => {
  it("ツール以外のパートは none", () => {
    expect(toolViewKind({ type: "text", text: "hi" } as Part)).toBe("none");
  });

  it("完了した createEvent は booking-result", () => {
    const part = toolPart({
      type: "tool-createEvent",
      state: "output-available",
      output: {}
    });
    expect(toolViewKind(part)).toBe("booking-result");
  });

  it("createEvent 以外の完了は汎用の tool-result", () => {
    const part = toolPart({ state: "output-available", output: {} });
    expect(toolViewKind(part)).toBe("tool-result");
  });

  it("承認待ちは approval", () => {
    const part = toolPart({
      state: "approval-requested",
      approval: { id: "a-1" }
    });
    expect(toolViewKind(part)).toBe("approval");
  });

  it("出力拒否は rejected", () => {
    const part = toolPart({ state: "output-denied" });
    expect(toolViewKind(part)).toBe("rejected");
  });

  it("承認が approved:false は rejected", () => {
    const part = toolPart({
      state: "input-available",
      approval: { approved: false }
    });
    expect(toolViewKind(part)).toBe("rejected");
  });

  it("実行中（input-available / input-streaming）は running", () => {
    expect(toolViewKind(toolPart({ state: "input-available" }))).toBe(
      "running"
    );
    expect(toolViewKind(toolPart({ state: "input-streaming" }))).toBe(
      "running"
    );
  });

  it("完了は承認待ち判定より優先される", () => {
    // output-available なら、approval が残っていても結果表示を出す。
    const part = toolPart({
      state: "output-available",
      output: {},
      approval: { id: "a-1" }
    });
    expect(toolViewKind(part)).toBe("tool-result");
  });
});
