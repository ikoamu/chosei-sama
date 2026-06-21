// =============================================================================
// client/components/participant/DetailsField
// 希望条件のテンプレボタンとフリーテキスト欄。
// =============================================================================

/** 希望条件のテンプレ文。クリックでテキストエリアに入れて微修正してもらう。 */
const TEMPLATES = {
  single: "30分のミーティングを来週中で。できれば午後希望。",
  recurring: "1時間の定例を隔週で、来月から6回。できれば午後希望。"
} as const;

export function DetailsField({
  details,
  setDetails,
  disabled
}: {
  details: string;
  setDetails: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-kumo-subtle">テンプレから入力:</span>
        {(["single", "recurring"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDetails(TEMPLATES[k])}
            disabled={disabled}
            className="px-2 py-0.5 rounded-md border border-kumo-line text-kumo-default hover:bg-kumo-control transition-colors disabled:opacity-50"
          >
            {k === "single" ? "単発" : "定例"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="block text-xs text-kumo-subtle mb-1">
          どんな調整？（所要時間・期間など）
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={disabled}
          rows={3}
          aria-label="調整の希望条件"
          placeholder="例: 30分のミーティングを来週中で。できれば午後希望。"
          className="w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-kumo-default placeholder:text-kumo-inactive focus:outline-none focus:ring-1 focus:ring-kumo-accent resize-none"
        />
      </label>
    </div>
  );
}
