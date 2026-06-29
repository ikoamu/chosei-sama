// =============================================================================
// client/components/message/MessageItem
// メッセージ1つ分。ツール／推論／テキストの各パートを描き分ける。
// =============================================================================

import type { UIMessage } from "ai";
import { ToolPartView } from "../ToolPartView";
import type { AddToolApprovalResponse } from "../tool/types";
import { ReasoningPart, type ReasoningPartData } from "./ReasoningPart";
import { TextPart } from "./TextPart";
import { renderableParts } from "./messageParts";

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

  // パートの並び・取捨は renderableParts（純粋・テスト済み）に委譲する。
  // 元の順序を保つことで、推論→ツールの並び逆転を防ぐ。
  return (
    <div className="space-y-2">
      {renderableParts(message.parts).map((entry, i) => {
        switch (entry.kind) {
          case "tool":
            return (
              <ToolPartView
                key={entry.part.toolCallId}
                part={entry.part}
                addToolApprovalResponse={addToolApprovalResponse}
              />
            );
          case "reasoning":
            return (
              <ReasoningPart
                key={`reasoning-${i}`}
                reasoning={entry.part as ReasoningPartData}
                isStreaming={isStreaming}
              />
            );
          case "text":
            return (
              <TextPart
                key={`text-${i}`}
                text={(entry.part as { type: "text"; text: string }).text}
                isUser={isUser}
                isLastAssistant={isLastAssistant}
                isStreaming={isStreaming}
              />
            );
        }
      })}
    </div>
  );
}
