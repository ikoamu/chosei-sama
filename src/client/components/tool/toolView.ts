// =============================================================================
// client/components/tool/toolView
// ツール呼び出しパートを、どの表示に振り分けるかだけ決める純粋関数。
// 描画（JSX）から状態判定を分離し、node 環境で単体テストできるようにする。
// =============================================================================

import { getToolName, isToolUIPart, type UIMessage } from "ai";

type Part = UIMessage["parts"][number];

/** ツールパートの表示種別。ToolPartView が対応するコンポーネントへ振り分ける。 */
export type ToolViewKind =
  | "none"
  | "booking-result"
  | "tool-result"
  | "approval"
  | "rejected"
  | "running";

/** ツールパートの状態から表示種別を決める。判定順序が表示の優先度を兼ねる。 */
export function toolViewKind(part: Part): ToolViewKind {
  if (!isToolUIPart(part)) {
    return "none";
  }

  // 完了（予約確定だけ専用表示、それ以外は汎用結果）
  if (part.state === "output-available") {
    return getToolName(part) === "createEvent"
      ? "booking-result"
      : "tool-result";
  }

  // 承認待ち
  if ("approval" in part && part.state === "approval-requested") {
    return "approval";
  }

  // 却下・拒否
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return "rejected";
  }

  // 実行中
  if (part.state === "input-available" || part.state === "input-streaming") {
    return "running";
  }

  return "none";
}
