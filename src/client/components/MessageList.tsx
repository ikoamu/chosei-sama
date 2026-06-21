// =============================================================================
// client/components/MessageList
// メッセージ配列の描画。各メッセージのツール／推論／テキストパートを描き分ける。
// デバッグモード時は生の JSON も表示する。
// =============================================================================

import { isToolUIPart, type UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { BrainIcon, CaretDownIcon } from "@phosphor-icons/react";
import { ToolPartView } from "./ToolPartView";

type ReasoningPartData = {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

/** 推論（reasoning）パート1つ分。折りたたみ表示。 */
function ReasoningPart({
  reasoning,
  isStreaming
}: {
  reasoning: ReasoningPartData;
  isStreaming: boolean;
}) {
  const isDone = reasoning.state === "done" || !isStreaming;
  return (
    <div className="flex justify-start">
      <details className="max-w-[85%] w-full" open={!isDone}>
        <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm select-none">
          <BrainIcon size={14} className="text-purple-400" />
          <span className="font-medium text-kumo-default">Reasoning</span>
          {isDone ? (
            <span className="text-xs text-kumo-success">Complete</span>
          ) : (
            <span className="text-xs text-kumo-brand">Thinking...</span>
          )}
          <CaretDownIcon size={14} className="ml-auto text-kumo-inactive" />
        </summary>
        <pre className="mt-2 px-3 py-2 rounded-lg bg-kumo-control text-xs text-kumo-default whitespace-pre-wrap overflow-auto max-h-64">
          {reasoning.text}
        </pre>
      </details>
    </div>
  );
}

/** テキストパート1つ分。ユーザーは右寄せ吹き出し、アシスタントは Streamdown。 */
function TextPart({
  text,
  isUser,
  isLastAssistant,
  isStreaming
}: {
  text: string;
  isUser: boolean;
  isLastAssistant: boolean;
  isStreaming: boolean;
}) {
  if (!text) {
    return null;
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-kumo-contrast text-kumo-inverse leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-kumo-base text-kumo-default leading-relaxed">
        <Streamdown
          className="sd-theme rounded-2xl rounded-bl-md p-3"
          plugins={{ code }}
          controls={false}
          isAnimating={isLastAssistant && isStreaming}
        >
          {text}
        </Streamdown>
      </div>
    </div>
  );
}

/** メッセージ1つ分。ツール／推論／テキストの各パートを描き分ける。 */
function MessageItem({
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
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
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

export function MessageList({
  messages,
  showDebug,
  isStreaming,
  addToolApprovalResponse
}: {
  messages: UIMessage[];
  showDebug: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
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
