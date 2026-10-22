// =============================================================================
// shared/criteria
// 調整条件（フォームの値）の型と、フォーム規則（既定値・必須項目）。
// client（フォーム）と server（候補提案 API）で共有する（docs/adr/0003）。
//   - 必須: 所要時間、（定期なら）回数
//   - 既定あり: 検索期間/開始日、単発/定期、頻度、曜日
//   - 任意: 希望時間帯
// 日付は tz ローカルの暦日（YYYY-MM-DD）で持ち、epoch ms への変換は server 側で行う。
// =============================================================================

import type { RecurringCandidate, SlotCandidate } from "../scheduler/types";

export interface SchedulingCriteria {
  kind: "one-off" | "recurring";
  /** 会議の長さ（分）。必須。 */
  durationMinutes: number | null;
  /** 単発なら検索期間の開始日、定期なら開始日（YYYY-MM-DD）。 */
  startDate: string;
  /** 単発の検索期間の終了日（YYYY-MM-DD、この日を含む）。 */
  endDate: string;
  /** 定期の頻度（1=毎週, 2=隔週）。 */
  everyNWeeks: number;
  /** 定期の回数。定期なら必須。 */
  occurrences: number | null;
  /** 候補に含める曜日（0=日 … 6=土）。 */
  weekdays: number[];
  /** 希望時間帯（ランキングを上げるだけで候補は絞らない）。 */
  preferredWindow: { startHour: number; endHour: number } | null;
}

/** 調整さまは日本時間固定で扱う。 */
const TIME_ZONE = "Asia/Tokyo";

/** Asia/Tokyo における今日（YYYY-MM-DD）。 */
export function todayInTimeZone(): string {
  // en-CA ロケールは YYYY-MM-DD 形式で出力する。
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date()
  );
}

/** 検索期間の既定の長さ（日）。 */
const DEFAULT_PERIOD_DAYS = 14;

/** YYYY-MM-DD に日数を足す（暦日計算なので UTC で行えばずれない）。 */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 既定値で埋めた調整条件。today は tz ローカルの今日（YYYY-MM-DD）。 */
export function defaultCriteria(today: string): SchedulingCriteria {
  return {
    kind: "one-off",
    durationMinutes: null,
    startDate: today,
    endDate: addDays(today, DEFAULT_PERIOD_DAYS),
    everyNWeeks: 1,
    occurrences: null,
    weekdays: [1, 2, 3, 4, 5],
    preferredWindow: null
  };
}

export type RequiredField = "durationMinutes" | "occurrences";

/** 必須項目のうち欠けているもの。空なら候補提案に進める。 */
export function missingRequired(c: SchedulingCriteria): RequiredField[] {
  const missing: RequiredField[] = [];
  if (c.durationMinutes == null) {
    missing.push("durationMinutes");
  }
  if (c.kind === "recurring" && c.occurrences == null) {
    missing.push("occurrences");
  }
  return missing;
}

/** 候補提案（POST /api/suggest）の応答。 */
export type SuggestResult =
  | { status: "candidates"; candidates: SlotCandidate[] | RecurringCandidate[] }
  /** free/busy を読めなかった参加者。1人でもいれば候補は出さない（空き可視性）。 */
  | { status: "unreadable"; ids: string[] }
  | { status: "none" };

export type CriteriaField = keyof SchedulingCriteria;

/** 調整条件の下書き（POST /api/draft の応答）。docs/adr/0003。 */
export interface CriteriaDraft {
  criteria: SchedulingCriteria;
  /** 要確認の項目（確からしさが低い・欠けた必須項目）。 */
  review: CriteriaField[];
  /** 文中に指定がなく、既定値で埋めた項目。 */
  defaulted: CriteriaField[];
  /** Jev が失敗した（手入力に切り替える）。 */
  failed: boolean;
}
