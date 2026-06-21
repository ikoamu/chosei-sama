// =============================================================================
// client/components/message/MessageItem
// メッセージ1つ分。ツール／推論／テキストの各パートを描き分ける。
// =============================================================================

import { isToolUIPart, type UIMessage } from "ai";
import { ToolPartView } from "../ToolPartView";
import type { AddToolApprovalResponse } from "../tool/types";
import { ReasoningPart, type ReasoningPartData } from "./ReasoningPart";
import { TextPart } from "./TextPart";

export function MessageItem({
  message,
  isLastAssistant,
  showDebug,
  isStreaming,
  addToolApprovalResponse
}: {
  message: UIMessage;
  isLastAssistant: boolean;
  showDebug: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: AddToolApprovalResponse;
}) {
  const isUser = message.role === "user";

  return (
    <div className="space-y-2">
      {showDebug && (
        <pre className="text-[11px] text-kumo-subtle bg-kumo-control rounded-lg p-3 overflow-auto max-h-64">
          {JSON.stringify(message, null, 2)}
        </pre>
      )}

      {/* Tool parts */}
      {message.parts.filter(isToolUIPart).map((part) => (
        <ToolPartView
          key={part.toolCallId}
          part={part}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      ))}

      {/* Reasoning parts */}
      {message.parts
        .filter(
          (part) =>
            part.type === "reasoning" &&
            (part as { text?: string }).text?.trim()
        )
        .map((part, i) => (
          <ReasoningPart
            key={i}
            reasoning={part as ReasoningPartData}
            isStreaming={isStreaming}
          />
        ))}

      {/* Text parts */}
      {message.parts
        .filter((part) => part.type === "text")
        .map((part, i) => (
          <TextPart
            key={i}
            text={(part as { type: "text"; text: string }).text}
            isUser={isUser}
            isLastAssistant={isLastAssistant}
            isStreaming={isStreaming}
          />
        ))}
    </div>
  );
}
