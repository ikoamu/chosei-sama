// =============================================================================
// client/components/chat/ErrorBanner
// エラー時のバナー（リトライ付き）。
// =============================================================================

import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";

export function ErrorBanner({
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
