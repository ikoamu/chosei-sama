// =============================================================================
// messageParts の単体テスト。並び順の保持と取捨を検証する。
// =============================================================================

import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { renderableParts } from "./messageParts";

type Part = UIMessage["parts"][number];

const text = (t: string): Part => ({ type: "text", text: t }) as Part;
const reasoning = (t: string): Part =>
  ({ type: "reasoning", text: t }) as unknown as Part;
const tool = (id: string): Part =>
  ({
    type: "tool-suggestSlots",
    toolCallId: id,
    state: "output-available",
    output: {}
  }) as unknown as Part;

describe("renderableParts", () => {
  it("元の順序を保つ（推論→ツールが逆転しない＝回帰テスト）", () => {
    const parts = [reasoning("考え中"), tool("c1"), text("候補です")];
    const kinds = renderableParts(parts).map((p) => p.kind);
    expect(kinds).toEqual(["reasoning", "tool", "text"]);
  });

  it("空テキストの reasoning は除外する", () => {
    const parts = [reasoning("   "), tool("c1")];
    const kinds = renderableParts(parts).map((p) => p.kind);
    expect(kinds).toEqual(["tool"]);
  });

  it("未知の種別は除外する", () => {
    const parts = [{ type: "step-start" } as Part, text("hi")];
    const kinds = renderableParts(parts).map((p) => p.kind);
    expect(kinds).toEqual(["text"]);
  });

  it("複数ツールと推論が混在しても順序を保つ", () => {
    const parts = [tool("c1"), reasoning("検討"), tool("c2"), text("結論")];
    const kinds = renderableParts(parts).map((p) => p.kind);
    expect(kinds).toEqual(["tool", "reasoning", "tool", "text"]);
  });

  it("tool パートは toolCallId を保持する", () => {
    const [entry] = renderableParts([tool("call-xyz")]);
    expect(entry.kind).toBe("tool");
    if (entry.kind === "tool") {
      expect(entry.part.toolCallId).toBe("call-xyz");
    }
  });
});
