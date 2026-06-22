// =============================================================================
// client/components/Chat
// メインのチャット画面。ステートフルな配線は useChatSession に委譲し、
// ここではレイアウトと各パーツの組み立てに専念する。
// =============================================================================

import { Empty } from "@cloudflare/kumo";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import { useChatSession } from "../hooks/useChatSession";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ParticipantPicker } from "./ParticipantPicker";
import { ThinkingIndicator } from "./chat/ThinkingIndicator";
import { ErrorBanner } from "./chat/ErrorBanner";
import { ChatInput } from "./chat/ChatInput";

export function Chat({ user }: { user: AuthUser }) {
  const session = useChatSession(user);
  const { messages, status, error, isStreaming, connected } = session;

  return (
    <div className="flex flex-col h-screen bg-kumo-elevated relative">
      <ChatHeader
        user={user}
        connected={connected}
        onClear={session.clearHistory}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
          {messages.length === 0 && (
            <Empty
              icon={<ChatCircleDotsIcon size={32} />}
              title="調整を始める"
              contents={
                <ParticipantPicker
                  self={user}
                  disabled={!connected || isStreaming}
                  onStart={session.startWithParticipants}
                />
              }
            />
          )}

          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            addToolApprovalResponse={session.addToolApprovalResponse}
          />

          {status === "submitted" && <ThinkingIndicator />}

          {status === "error" && error && (
            <ErrorBanner message={error.message} onRetry={session.retryLast} />
          )}

          <div ref={session.messagesEndRef} />
        </div>
      </div>

      {/* Input — 初回は参加者ピッカーが入力口になるため下部欄は隠す */}
      {messages.length > 0 && (
        <ChatInput
          input={session.input}
          setInput={session.setInput}
          getTextareaProps={session.getTextareaProps}
          triggerSubmit={session.triggerSubmit}
          isStreaming={isStreaming}
          connected={connected}
          onStop={session.stop}
        />
      )}
    </div>
  );
}
