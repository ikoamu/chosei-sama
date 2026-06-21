// =============================================================================
// client/components/tool/BookingSummary
// createEvent の承認カードに出す、人間が読める予約内容の要約。
// =============================================================================

export function BookingSummary({ input }: { input: unknown }) {
  const ev = (input ?? {}) as {
    title?: string;
    startISO?: string;
    endISO?: string;
    attendees?: string[];
    timeZone?: string;
    addMeet?: boolean;
    recurrence?: { everyNWeeks?: number; occurrences?: number };
  };
  const tz = ev.timeZone || "Asia/Tokyo";
  const fmt = (iso?: string) => {
    if (!iso) {
      return "—";
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString("ja-JP", {
          timeZone: tz,
          dateStyle: "medium",
          timeStyle: "short"
        });
  };
  const row = (label: string, value: string) => (
    <div className="flex gap-2 text-xs">
      <span className="text-kumo-subtle shrink-0 w-12">{label}</span>
      <span className="text-kumo-default break-all">{value}</span>
    </div>
  );
  const recur = ev.recurrence;
  const recurText = recur
    ? `${recur.everyNWeeks === 1 ? "毎週" : `${recur.everyNWeeks}週ごと`}・全${recur.occurrences}回`
    : null;
  return (
    <div className="space-y-1">
      {row("件名", ev.title || "（無題）")}
      {row("日時", `${fmt(ev.startISO)} 〜 ${fmt(ev.endISO)}`)}
      {recurText && row("繰り返し", recurText)}
      {row("参加者", ev.attendees?.length ? ev.attendees.join("、") : "なし")}
      {row("Meet", ev.addMeet === false ? "なし" : "あり")}
    </div>
  );
}
