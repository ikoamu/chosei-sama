// =============================================================================
// client/components/tool/BookingResult
// createEvent 実行後の完了/失敗を読める形で表示する。
// =============================================================================

import { Surface, Text } from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  VideoCameraIcon,
  WarningCircleIcon
} from "@phosphor-icons/react";

export function BookingResult({ output }: { output: unknown }) {
  const res = (output ?? {}) as {
    created?: boolean;
    alreadyExists?: boolean;
    htmlLink?: string;
    hangoutLink?: string;
    message?: string;
    error?: string;
  };

  // 失敗（スコープ不足・読めない参加者・その他）。
  if (res.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] flex items-start gap-2.5 px-4 py-3 rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/20 text-sm">
          <WarningCircleIcon
            size={18}
            className="text-red-500 shrink-0 mt-0.5"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-kumo-default">予約できませんでした。</p>
            <p className="text-xs text-kumo-subtle break-all">{res.error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <Surface className="max-w-[85%] px-4 py-3 rounded-xl ring ring-kumo-line space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircleIcon size={16} className="text-kumo-success" />
          <Text size="sm" bold>
            {res.alreadyExists ? "同じ予約が作成済みです" : "予約しました"}
          </Text>
        </div>
        {res.message && (
          <Text size="xs" variant="secondary">
            {res.message}
          </Text>
        )}
        <div className="flex flex-wrap gap-3">
          {res.htmlLink && (
            <a
              href={res.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-kumo-accent hover:underline"
            >
              <ArrowSquareOutIcon size={14} />
              Google カレンダーで開く
            </a>
          )}
          {res.hangoutLink && (
            <a
              href={res.hangoutLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-kumo-accent hover:underline"
            >
              <VideoCameraIcon size={14} />
              Meet を開く
            </a>
          )}
        </div>
      </Surface>
    </div>
  );
}
