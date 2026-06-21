// =============================================================================
// client/components/MessageList
// メッセージ配列の描画。各メッセージの描き分けは MessageItem に委譲する。
// =============================================================================

import type { UIMessage } from "ai";
import type { AddToolApprovalResponse } from "./tool/types";
import { MessageItem } from "./message/MessageItem";

export function MessageList({
  messages,
  showDebug,
  isStreaming,
  addToolApprovalResponse
}: {
  messages: UIMessage[];
  showDebug: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: AddToolApprovalResponse;
}) {
  return (
    <>
      {messages.map((message: UIMessage, index: number) => (
        <MessageItem
          key={message.id}
          message={message}
          isLastAssistant={
            message.role === "assistant" && index === messages.length - 1
          }
          showDebug={showDebug}
          isStreaming={isStreaming}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      ))}
    </>
  );
}
