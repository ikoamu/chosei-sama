// =============================================================================
// client/components/MessageList
// メッセージ配列の描画。各メッセージの描き分けは MessageItem に委譲する。
// =============================================================================

import type { UIMessage } from "ai";
import type { AddToolApprovalResponse } from "./tool/types";
import { MessageItem } from "./message/MessageItem";

export function MessageList({
  messages,
  isStreaming,
  addToolApprovalResponse
}: {
  messages: UIMessage[];
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
          isStreaming={isStreaming}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      ))}
    </>
  );
}
