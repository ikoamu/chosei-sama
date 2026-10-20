// =============================================================================
// client/components/SuggestResultView
// 候補提案の結果表示。単発は日時、定期は曜日・時刻と各回の日付を並べる。
// 読めない参加者がいれば名指しして、参加者の見直しを促す（空き可視性）。
// =============================================================================

import { Text } from "@cloudflare/kumo";
import type { RecurringCandidate, SlotCandidate } from "../../scheduler/types";
import type { SuggestResult } from "../../shared/criteria";
import { formatDateTime, formatTime } from "../lib/suggest";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function isRecurring(
  c: SlotCandidate | RecurringCandidate
): c is RecurringCandidate {
  return "occurrenceStartsISO" in c;
}

export function SuggestResultView({ result }: { result: SuggestResult }) {
  if (result.status === "unreadable") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        次の参加者の空き情報を取得できませんでした: {result.ids.join("、")}
        。参加者から外すか、カレンダーの予定共有設定をご確認ください。
      </div>
    );
  }
  if (result.status === "none") {
    return (
      <Text size="sm" variant="secondary">
        条件に合う、全員が空いている枠が見つかりませんでした。
      </Text>
    );
  }
  return (
    <ul className="space-y-2">
      {result.candidates.map((c) => (
        <li
          key={isRecurring(c) ? `${c.weekday}-${c.localTime}` : c.startISO}
          className="rounded-lg border border-kumo-line bg-kumo-base p-3 text-sm"
        >
          {isRecurring(c) ? (
            <>
              <div className="font-semibold">
                毎{WEEKDAY_LABELS[c.weekday]}曜 {c.localTime}〜
              </div>
              <div className="text-xs text-kumo-subtle">
                {c.occurrenceStartsISO.map(formatDateTime).join(" / ")}
              </div>
            </>
          ) : (
            <div className="font-semibold">
              {formatDateTime(c.startISO)}〜{formatTime(c.endISO)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
