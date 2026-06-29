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
  isStreaming,
  addToolApprovalResponse
}: {
  message: UIMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: AddToolApprovalResponse;
}) {
  const isUser = message.role === "user";

  // パートは元の順序のまま描画する。型ごとにまとめると推論→ツールの並びが
  // 逆転し、完了済み Reasoning が「考え中…」の直上に来てしまうため。
  return (
    <div className="space-y-2">
      {message.parts.map((part, i) => {
        if (isToolUIPart(part)) {
          return (
            <ToolPartView
              key={part.toolCallId}
              part={part}
              addToolApprovalResponse={addToolApprovalResponse}
            />
          );
        }

        if (part.type === "reasoning") {
          const reasoning = part as ReasoningPartData;
          if (!reasoning.text?.trim()) {
            return null;
          }
          return (
            <ReasoningPart
              key={`reasoning-${i}`}
              reasoning={reasoning}
              isStreaming={isStreaming}
            />
          );
        }

        if (part.type === "text") {
          return (
            <TextPart
              key={`text-${i}`}
              text={(part as { type: "text"; text: string }).text}
              isUser={isUser}
              isLastAssistant={isLastAssistant}
              isStreaming={isStreaming}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
