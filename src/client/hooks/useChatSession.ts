// =============================================================================
// client/hooks/useChatSession
// チャット画面のステートフルな配線をまとめたフック。
// WebSocket 接続・メッセージ送受信・ツール承認・スケジュール完了通知・
// 入力欄の送信ハンドリング・自動スクロール／フォーカスを担う。
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { useChatSubmit } from "use-chat-submit";
import type { UIMessage } from "ai";
import type { ChatAgent } from "../../server/chat-agent";
import type { AuthUser } from "../types";
import type { DirectoryPerson } from "../lib/directory";
import { buildScheduleMessage } from "../lib/participants";

type Toasts = ReturnType<typeof useKumoToastManager>;

/** スケジュール完了イベント（JSON）を受け取りトーストで知らせる。それ以外は無視。 */
function notifyScheduledTask(message: MessageEvent, toasts: Toasts) {
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
}

/** WebSocket 接続の確立と接続状態を管理する。 */
function useAgentConnection(user: AuthUser) {
  const [connected, setConnected] = useState(false);
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
      (message: MessageEvent) => notifyScheduledTask(message, toasts),
      [toasts]
    )
  });

  return { agent, connected };
}

type SendUserMessage = (message: {
  role: "user";
  parts: { type: "text"; text: string }[];
}) => void;

/** 参加者ピッカーからの起動と、エラー時のリトライ送信をまとめる。 */
function useChatActions(
  user: AuthUser,
  messages: UIMessage[],
  sendMessage: SendUserMessage
) {
  const startWithParticipants = useCallback(
    (people: DirectoryPerson[], details: string) => {
      sendMessage({
        role: "user",
        parts: [
          { type: "text", text: buildScheduleMessage(people, user, details) }
        ]
      });
    },
    [sendMessage, user]
  );

  // 直近のユーザー発話を再送する（エラー時のリトライ）。
  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const textPart = lastUser?.parts.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: textPart.text }]
      });
    }
  }, [messages, sendMessage]);

  return { startWithParticipants, retryLast };
}

/** useChatSession が返す配線一式。子コンポーネントの prop 型付けに使う。 */
export type ChatSession = ReturnType<typeof useChatSession>;

export function useChatSession(user: AuthUser) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { agent, connected } = useAgentConnection(user);

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    stop,
    status,
    error
  } = useAgentChat({ agent });

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

  const { startWithParticipants, retryLast } = useChatActions(
    user,
    messages,
    sendMessage
  );

  return {
    connected,
    input,
    setInput,
    messages,
    status,
    error,
    isStreaming,
    clearHistory,
    addToolApprovalResponse,
    stop,
    getTextareaProps,
    triggerSubmit,
    startWithParticipants,
    retryLast,
    messagesEndRef
  };
}
