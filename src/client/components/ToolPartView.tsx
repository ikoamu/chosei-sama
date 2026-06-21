// =============================================================================
// client/components/ToolPartView
// ツール呼び出しパートの表示ディスパッチャ。状態に応じて tool/ 配下の各表示に振り分ける。
// =============================================================================

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { AddToolApprovalResponse } from "./tool/types";
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
  if (!isToolUIPart(part)) {
    return null;
  }
  const toolName = getToolName(part);

  // Completed
  if (part.state === "output-available") {
    return toolName === "createEvent" ? (
      <BookingResult output={part.output} />
    ) : (
      <ToolResult toolName={toolName} output={part.output} />
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    return (
      <ToolApproval
        toolName={toolName}
        input={part.input}
        approvalId={(part.approval as { id?: string })?.id}
        addToolApprovalResponse={addToolApprovalResponse}
      />
    );
  }

  // Rejected / denied
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return <ToolRejected toolName={toolName} />;
  }

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
    return <ToolRunning toolName={toolName} />;
  }

  return null;
}
