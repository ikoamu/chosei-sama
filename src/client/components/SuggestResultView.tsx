// =============================================================================
// client/components/SuggestResultView
// 候補提案の結果表示。単発は日時、定期は曜日・時刻と各回の日付を並べ、
// 各候補に予約ボタンを付ける。読めない参加者がいれば名指しして、
// 参加者の見直しを促す（空き可視性）。
// =============================================================================

import { Text } from "@cloudflare/kumo";
import type { RecurringCandidate, SlotCandidate } from "../../scheduler/types";
import type { SchedulingCriteria, SuggestResult } from "../../shared/criteria";
import type { BookingRequest, Participant } from "../../shared/booking";
import { formatDateTime, formatTime } from "../lib/suggest";
import { BookButton } from "./BookButton";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function isRecurring(
  c: SlotCandidate | RecurringCandidate
): c is RecurringCandidate {
  return "occurrenceStartsISO" in c;
}

const FREQUENCY_LABELS: Record<number, string> = { 1: "毎週", 2: "隔週" };

/** 候補 1 件を予約確定の入力にする。定期は初回の開始時刻＋繰り返し。 */
function bookingFor(
  c: SlotCandidate | RecurringCandidate,
  criteria: SchedulingCriteria,
  participants: Participant[]
): BookingRequest {
  const base = {
    participants,
    durationMinutes: criteria.durationMinutes ?? 0
  };
  return isRecurring(c)
    ? {
        ...base,
        startISO: c.startISOFirst,
        recurrence: {
          everyNWeeks: criteria.everyNWeeks,
          occurrences: criteria.occurrences ?? c.occurrenceStartsISO.length
        }
      }
    : { ...base, startISO: c.startISO };
}

export function SuggestResultView({
  result,
  criteria,
  participants
}: {
  result: SuggestResult;
  /** 候補を探したときの調整条件（予約の所要時間・繰り返しに使う）。 */
  criteria: SchedulingCriteria;
  participants: Participant[];
}) {
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
          className="rounded-lg border border-kumo-line bg-kumo-base p-3 text-sm flex items-center justify-between gap-3"
        >
          {isRecurring(c) ? (
            <div>
              <div className="font-semibold">
                {FREQUENCY_LABELS[criteria.everyNWeeks] ??
                  `${criteria.everyNWeeks}週ごと`}{" "}
                {WEEKDAY_LABELS[c.weekday]}曜 {c.localTime}〜
              </div>
              <div className="text-xs text-kumo-subtle">
                {c.occurrenceStartsISO.map(formatDateTime).join(" / ")}
              </div>
            </div>
          ) : (
            <div className="font-semibold">
              {formatDateTime(c.startISO)}〜{formatTime(c.endISO)}
            </div>
          )}
          <BookButton request={bookingFor(c, criteria, participants)} />
        </li>
      ))}
    </ul>
  );
}
