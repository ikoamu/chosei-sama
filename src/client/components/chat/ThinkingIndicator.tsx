// =============================================================================
// client/components/chat/ThinkingIndicator
// 送信後・最初のトークン到着前に出す「考え中…」表示。
// =============================================================================

export function ThinkingIndicator() {
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
