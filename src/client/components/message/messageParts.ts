// =============================================================================
// client/components/message/messageParts
// メッセージのパート列を「描画する順序のまま」分類する純粋関数。
// 型ごとにまとめると推論→ツールの並びが逆転するため、元の順序を保つ。
// =============================================================================

import { isToolUIPart, type UIMessage } from "ai";

type Part = UIMessage["parts"][number];
type ToolPart = Extract<Part, { toolCallId: string }>;

/** 描画対象のパート。元の順序を保ったまま種別タグを付ける。 */
export type RenderablePart =
  | { kind: "tool"; part: ToolPart }
  | { kind: "reasoning"; part: Part }
  | { kind: "text"; part: Part };

/**
 * 描画すべきパートだけを元の順序で返す。
 * - 空テキストの reasoning は出さない（折りたたみが空になるため）
 * - 未知の種別は除外する
 */
export function renderableParts(parts: Part[]): RenderablePart[] {
  const result: RenderablePart[] = [];

  for (const part of parts) {
    if (isToolUIPart(part)) {
      result.push({ kind: "tool", part });
      continue;
    }
    if (part.type === "reasoning") {
      if ((part as { text?: string }).text?.trim()) {
        result.push({ kind: "reasoning", part });
      }
      continue;
    }
    if (part.type === "text") {
      result.push({ kind: "text", part });
    }
  }

  return result;
}
