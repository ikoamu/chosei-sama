// =============================================================================
// client/components/message/TextPart
// テキストパート1つ分。ユーザーは右寄せ吹き出し、アシスタントは Streamdown。
// =============================================================================

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";

export function TextPart({
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
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-kumo-contrast text-kumo-inverse leading-relaxed whitespace-pre-wrap break-words">
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
