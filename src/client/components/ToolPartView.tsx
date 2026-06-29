// =============================================================================
// client/components/ToolPartView
// ツール呼び出しパートの表示ディスパッチャ。状態に応じて tool/ 配下の各表示に振り分ける。
// =============================================================================

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { AddToolApprovalResponse } from "./tool/types";
import { toolViewKind } from "./tool/toolView";
import { BookingResult } from "./tool/BookingResult";
import { ToolApproval } from "./tool/ToolApproval";
import { ToolRejected } from "./tool/ToolRejected";
import { ToolResult } from "./tool/ToolResult";
import { ToolRunning } from "./tool/ToolRunning";

export function ToolPartView({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: AddToolApprovalResponse;
}) {
  // 状態 → 表示種別の判定は toolViewKind（純粋・テスト済み）に委譲し、
  // ここは種別ごとのコンポーネント差し込みに専念する。
  if (!isToolUIPart(part)) {
    return null;
  }
  const toolName = getToolName(part);

  switch (toolViewKind(part)) {
    case "booking-result":
      return <BookingResult output={part.output} />;
    case "tool-result":
      return <ToolResult toolName={toolName} output={part.output} />;
    case "approval":
      return (
        <ToolApproval
          toolName={toolName}
          input={part.input}
          approvalId={(part.approval as { id?: string })?.id}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      );
    case "rejected":
      return <ToolRejected toolName={toolName} />;
    case "running":
      return <ToolRunning toolName={toolName} />;
    default:
      return null;
  }
}
