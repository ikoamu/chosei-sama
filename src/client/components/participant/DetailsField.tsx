// =============================================================================
// client/components/participant/DetailsField
// 希望条件のテンプレボタンとフリーテキスト欄。
// =============================================================================

// 希望条件のテンプレ。最低限の項目をラベル付きで埋めた状態にし、クリックで
// テキストエリアに入れて値だけ微修正してもらう（聞き返しを減らす）。
// 入力はあくまでフリーテキスト（UI ウィジェットは持たない。docs/adr/0002）。
const TEMPLATES = {
  single: [
    "予定の名前: MTG",
    "単発or定例: 単発",
    "所要時間: 1h",
    "いつ: 今月中",
    "曜日や時間帯: いつでも"
  ].join("\n"),
  recurring: [
    "予定の名前: 定例MTG",
    "単発or定例: 定例",
    "所要時間: 1h",
    "頻度: 毎週",
    "いつから: 来週から",
    "いつまで: 来月末まで",
    "曜日や時間帯: いつでも"
  ].join("\n")
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
          どんな調整？（テンプレを選んで値を直すか、自由に記入）
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={disabled}
          rows={6}
          aria-label="調整の希望条件"
          placeholder={
            "予定の名前: MTG\n単発or定例: 単発\n所要時間: 1h\nいつ: 今月中\n曜日や時間帯: いつでも"
          }
          className="w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-kumo-default placeholder:text-kumo-inactive focus:outline-none focus:ring-1 focus:ring-kumo-accent resize-none"
        />
      </label>
    </div>
  );
}
