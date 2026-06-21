// =============================================================================
// client/components/message/ReasoningPart
// 推論（reasoning）パート1つ分。折りたたみ表示。
// =============================================================================

import { BrainIcon, CaretDownIcon } from "@phosphor-icons/react";

export type ReasoningPartData = {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

export function ReasoningPart({
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
