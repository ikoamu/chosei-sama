// =============================================================================
// client/components/Chat
// メインのチャット画面。WebSocket 経由で ChatAgent に接続し、メッセージの送受信・
// ツール承認・スケジュール完了通知・参加者ピッカーからの起動を取りまとめる。
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Button, Empty, InputArea } from "@cloudflare/kumo";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  ArrowClockwiseIcon,
  ChatCircleDotsIcon,
  PaperPlaneRightIcon,
  StopIcon,
  WarningCircleIcon
} from "@phosphor-icons/react";
import { useChatSubmit } from "use-chat-submit";
import type { ChatAgent } from "../../server/chat-agent";
import type { AuthUser } from "../types";
import type { DirectoryPerson } from "../lib/directory";
import {
  buildScheduleMessage,
  type ScheduleOptions
} from "../lib/participants";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ParticipantPicker } from "./ParticipantPicker";

export function Chat({ user }: { user: AuthUser }) {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toasts = useKumoToastManager();

  const agent = useAgent<ChatAgent>({
    agent: "ChatAgent",
    name: user.email,
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback(
      (error: Event) => console.error("WebSocket error:", error),
      []
    ),
    onMessage: useCallback(
      (message: MessageEvent) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data.type === "scheduled-task") {
            toasts.add({
              title: "Scheduled task completed",
              description: data.description,
              timeout: 0
            });
          }
        } catch {
          // Not JSON or not our event
        }
      },
      [toasts]
    )
  });

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    stop,
    status,
    error
  } = useAgentChat({
    agent,
    onToolCall: async (event) => {
      if (
        "addToolOutput" in event &&
        event.toolCall.toolName === "getUserTimezone"
      ) {
        event.addToolOutput({
          toolCallId: event.toolCall.toolCallId,
          output: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString()
          }
        });
      }
    }
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Enter=改行 / Cmd・Ctrl+Enter=送信。IME変換中の誤送信も内部で抑止される。
  const { getTextareaProps, triggerSubmit, textareaRef } = useChatSubmit({
    mode: "mod-enter",
    onSubmit: (value) => {
      const text = value.trim();
      if (!text || isStreaming) {
        return;
      }
      setInput("");
      sendMessage({ role: "user", parts: [{ type: "text", text }] });
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming, textareaRef]);

  const startWithParticipants = useCallback(
    (people: DirectoryPerson[], options: ScheduleOptions) => {
      sendMessage({
        role: "user",
        parts: [
          {
            type: "text",
            text: buildScheduleMessage(people, user, options)
          }
        ]
      });
    },
    [sendMessage, user]
  );

  return (
    <div className="flex flex-col h-screen bg-kumo-elevated relative">
      <ChatHeader
        user={user}
        connected={connected}
        showDebug={showDebug}
        onToggleDebug={setShowDebug}
        onClear={clearHistory}
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
                  onStart={startWithParticipants}
                />
              }
            />
          )}

          <MessageList
            messages={messages}
            showDebug={showDebug}
            isStreaming={isStreaming}
            addToolApprovalResponse={addToolApprovalResponse}
          />

          {/* Thinking indicator — visible after send, before first token */}
          {status === "submitted" && (
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
          )}

          {/* Error banner with retry */}
          {status === "error" && error && (
            <div className="flex justify-start">
              <div className="max-w-[85%] flex items-start gap-2.5 px-4 py-3 rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/20 text-sm">
                <WarningCircleIcon
                  size={18}
                  className="text-red-500 shrink-0 mt-0.5"
                />
                <div className="min-w-0 space-y-2">
                  <p className="text-kumo-default">
                    エラーが発生しました。もう一度お試しください。
                  </p>
                  <p className="text-xs text-kumo-subtle break-all">
                    {error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const lastUser = [...messages]
                        .reverse()
                        .find((m) => m.role === "user");
                      if (lastUser) {
                        const textPart = lastUser.parts.find(
                          (p) => p.type === "text"
                        );
                        if (textPart && "text" in textPart) {
                          sendMessage({
                            role: "user",
                            parts: [{ type: "text", text: textPart.text }]
                          });
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    <ArrowClockwiseIcon size={14} />
                    リトライ
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input — 初回は参加者ピッカーが入力口になるため下部欄は隠す */}
      {messages.length > 0 && (
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
                  onClick={stop}
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
      )}
    </div>
  );
}
