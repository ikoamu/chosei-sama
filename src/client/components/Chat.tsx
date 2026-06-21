// =============================================================================
// client/components/Chat
// メインのチャット画面。ステートフルな配線は useChatSession に委譲し、
// ここではレイアウトと各パーツの組み立てに専念する。
// =============================================================================

import { Button, Empty, InputArea } from "@cloudflare/kumo";
import {
  ArrowClockwiseIcon,
  ChatCircleDotsIcon,
  PaperPlaneRightIcon,
  StopIcon,
  WarningCircleIcon
} from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import { useChatSession } from "../hooks/useChatSession";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ParticipantPicker } from "./ParticipantPicker";

type ChatSession = ReturnType<typeof useChatSession>;

/** 送信後・最初のトークン到着前に出す「考え中…」表示。 */
function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-bl-md bg-kumo-base text-kumo-subtle text-sm">
        <span className="thinking-dots flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-[dot-bounce_1.4s_ease-in-out_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-[dot-bounce_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-[dot-bounce_1.4s_ease-in-out_0.4s_infinite]" />
        </span>
        考え中…
      </div>
    </div>
  );
}

/** エラー時のバナー（リトライ付き）。 */
function ErrorBanner({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] flex items-start gap-2.5 px-4 py-3 rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/20 text-sm">
        <WarningCircleIcon size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-2">
          <p className="text-kumo-default">
            エラーが発生しました。もう一度お試しください。
          </p>
          <p className="text-xs text-kumo-subtle break-all">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            <ArrowClockwiseIcon size={14} />
            リトライ
          </button>
        </div>
      </div>
    </div>
  );
}

/** 下部の入力欄。初回は参加者ピッカーが入力口になるため呼び出し側で出し分ける。 */
function ChatInput({
  input,
  setInput,
  getTextareaProps,
  triggerSubmit,
  isStreaming,
  connected,
  onStop
}: {
  input: string;
  setInput: ChatSession["setInput"];
  getTextareaProps: ChatSession["getTextareaProps"];
  triggerSubmit: ChatSession["triggerSubmit"];
  isStreaming: boolean;
  connected: boolean;
  onStop: () => void;
}) {
  return (
    <div className="border-t border-kumo-line bg-kumo-base">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          triggerSubmit();
        }}
        className="max-w-3xl mx-auto px-5 py-4"
      >
        <div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm focus-within:ring-2 focus-within:ring-kumo-ring focus-within:border-transparent transition-shadow">
          <InputArea
            {...getTextareaProps({
              value: input,
              onChange: (e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            })}
            placeholder="メッセージを入力…（Enterで改行／⌘・Ctrl+Enterで送信）"
            disabled={!connected || isStreaming}
            rows={1}
            className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="secondary"
              shape="square"
              aria-label="Stop generation"
              icon={<StopIcon size={18} />}
              onClick={onStop}
              className="mb-0.5"
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              shape="square"
              aria-label="Send message"
              disabled={!input.trim() || !connected}
              icon={<PaperPlaneRightIcon size={18} />}
              className="mb-0.5"
            />
          )}
        </div>
      </form>
    </div>
  );
}

export function Chat({ user }: { user: AuthUser }) {
  const session = useChatSession(user);
  const { messages, status, error, isStreaming, connected } = session;

  return (
    <div className="flex flex-col h-screen bg-kumo-elevated relative">
      <ChatHeader
        user={user}
        connected={connected}
        showDebug={session.showDebug}
        onToggleDebug={session.setShowDebug}
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
            showDebug={session.showDebug}
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
