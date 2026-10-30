// =============================================================================
// client/components/criteria/DraftInput
// 調整条件の自然文を書く欄と「下書きを作る」ボタン。
// Jev が下書きを作ってフォームを埋める（docs/adr/0003）。
// =============================================================================

import { useState } from "react";
import { Button } from "@cloudflare/kumo";
import { SparkleIcon } from "@phosphor-icons/react";

export function DraftInput({
  drafting,
  failed,
  disabled,
  onDraft
}: {
  drafting: boolean;
  /** 前回の下書きが失敗した（手入力を促す）。 */
  failed: boolean;
  disabled: boolean;
  onDraft: (details: string) => void;
}) {
  const [details, setDetails] = useState("");
  return (
    <div className="space-y-2">
      <span className="block text-xs text-kumo-subtle">
        どんな調整？（例: 隔週1h、来月開始、できれば午後）
      </span>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        disabled={disabled || drafting}
        rows={3}
        aria-label="調整の希望条件"
        className="w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-kumo-default focus:outline-none focus:ring-1 focus:ring-kumo-accent resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-red-600">
          {failed &&
            "自動で読み取れませんでした。下のフォームに手で入力してください。"}
        </span>
        <Button
          variant="secondary"
          icon={<SparkleIcon size={16} />}
          disabled={disabled || drafting || !details.trim()}
          onClick={() => onDraft(details)}
        >
          {drafting ? "読み取り中…" : "下書きを作る"}
        </Button>
      </div>
    </div>
  );
}
