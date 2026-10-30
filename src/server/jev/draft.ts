// =============================================================================
// server/jev/draft
// Jev の答え（選択肢・確からしさ）を、調整条件の下書きに変換する純粋関数。
// Jev は値を自由に抜き出せず数値・日付の計算も苦手なため、項目はすべて
// 選択肢で選ばせ、日付の計算はここで行う（docs/adr/0003）。
//   - 確からしさが閾値未満 → 値は残して要確認
//   - 「該当なし」→ 既定ありの項目は既定値（defaulted）、必須の項目は要確認
// =============================================================================

import {
  addDays,
  defaultCriteria,
  type CriteriaDraft,
  type CriteriaField,
  type SchedulingCriteria
} from "../../shared/criteria";

interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
}
interface NoulAnswer {
  type: "noul";
  noul: number;
}
export type JevAnswers = Record<string, ChoiceAnswer | NoulAnswer>;

/** これ未満の確からしさの項目は要確認にする。 */
const CONFIDENCE_THRESHOLD = 0.8;
const NONE = "none";

const WINDOWS: Record<string, { startHour: number; endHour: number }> = {
  morning: { startHour: 9, endHour: 12 },
  afternoon: { startHour: 13, endHour: 17 },
  evening: { startHour: 16, endHour: 18 }
};
const FREQUENCIES: Record<string, number> = {
  weekly: 1,
  biweekly: 2,
  every4weeks: 4
};

/** 下書きを組み立てる途中の状態。 */
class DraftBuilder {
  readonly review = new Set<CriteriaField>();
  readonly defaulted = new Set<CriteriaField>();

  constructor(private readonly answers: JevAnswers) {}

  /**
   * Choice の答え。「該当なし」なら null。確からしさが低ければ fields を要確認にする。
   */
  pick(key: string, fields: CriteriaField[]): string | null {
    const a = this.answers[key];
    if (a?.type !== "choice") {
      fields.forEach((f) => this.review.add(f));
      return null;
    }
    if (a.confidence < CONFIDENCE_THRESHOLD) {
      fields.forEach((f) => this.review.add(f));
    }
    return a.choice === NONE ? null : a.choice;
  }

  /** 必須項目。値がなければ要確認。 */
  required(field: CriteriaField, value: number | null): number | null {
    if (value == null) {
      this.review.add(field);
    }
    return value;
  }

  /** 既定ありの項目。値がなければ既定値で埋める。 */
  orDefault<T>(field: CriteriaField, value: T | null, fallback: T): T {
    if (value == null) {
      this.defaulted.add(field);
      return fallback;
    }
    return value;
  }
}

/** Noul（はい の確率）がこの範囲なら、どちらとも言えないとして要確認にする。 */
const NOUL_YES = 0.8;
const NOUL_NO = 0.2;

/** 曜日ごとの Noul（wd0〜wd6）から、指定された曜日。1 つもなければ null。 */
function resolveWeekdays(
  b: DraftBuilder,
  answers: JevAnswers
): number[] | null {
  const selected: number[] = [];
  for (let d = 0; d < 7; d++) {
    const a = answers[`wd${d}`];
    const p = a?.type === "noul" ? a.noul : 0.5;
    if (p >= NOUL_YES) {
      selected.push(d);
    } else if (p > NOUL_NO) {
      b.review.add("weekdays");
    }
  }
  return selected.length > 0 ? selected : null;
}

/** 日付指定のときの検索期間の長さ（日）。 */
const PERIOD_FROM_DATE_DAYS = 14;
const PERIOD_FIELDS: CriteriaField[] = ["startDate", "endDate"];

/** YYYY-MM-DD の曜日（0=日 … 6=土）。 */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** year 年 month 月（1-12）の末日。 */
function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** 月日の指定を、今日以降で最初に来る日付にする（今日より前なら翌年）。 */
function upcomingDate(
  today: string,
  month: number,
  day: number
): string | null {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const d = new Date(Date.UTC(y, month - 1, day));
    // 2/30 のような存在しない日付は繰り上がるので弾く。
    if (d.getUTCMonth() !== month - 1) {
      return null;
    }
    const iso = d.toISOString().slice(0, 10);
    if (iso >= today) {
      return iso;
    }
  }
  return null;
}

/**
 * 期間の起点から [開始日, 終了日]（週は月曜始まり）。指定がない・読めなければ null。
 */
function resolvePeriod(
  b: DraftBuilder,
  today: string
): readonly [string, string] | null {
  const anchor = b.pick("anchor", PERIOD_FIELDS);
  const [year, month] = today.split("-").map(Number);
  // 今日から次の月曜までの日数（日曜なら 1、月曜なら 7）。
  const toNextMonday = (8 - weekdayOf(today)) % 7 || 7;
  switch (anchor) {
    case "today":
      return [today, today];
    case "this_week":
      return [today, addDays(today, toNextMonday - 1)];
    case "next_week": {
      const monday = addDays(today, toNextMonday);
      return [monday, addDays(monday, 6)];
    }
    case "this_month":
      return [today, lastDayOfMonth(year, month)];
    case "next_month": {
      const next = month === 12 ? [year + 1, 1] : [year, month + 1];
      const first = `${next[0]}-${String(next[1]).padStart(2, "0")}-01`;
      return [first, lastDayOfMonth(next[0], next[1])];
    }
    case "within_days": {
      const days = b.pick("within_days", PERIOD_FIELDS);
      return days == null ? null : [today, addDays(today, Number(days))];
    }
    case "date": {
      const m = b.pick("month", PERIOD_FIELDS);
      const d = b.pick("day", PERIOD_FIELDS);
      const start =
        m == null || d == null
          ? null
          : upcomingDate(today, Number(m), Number(d));
      if (start == null) {
        PERIOD_FIELDS.forEach((f) => b.review.add(f));
        return null;
      }
      return [start, addDays(start, PERIOD_FROM_DATE_DAYS)];
    }
    default:
      return null;
  }
}

export function draftFromAnswers(
  answers: JevAnswers,
  today: string
): CriteriaDraft {
  const b = new DraftBuilder(answers);
  const defaults = defaultCriteria(today);

  const kind = b.pick("kind", ["kind"]);
  const duration = b.pick("duration", ["durationMinutes"]);
  const frequency = b.pick("frequency", ["everyNWeeks"]);
  const occurrences = b.pick("occurrences", ["occurrences"]);
  const window = b.pick("window", ["preferredWindow"]);
  const period = resolvePeriod(b, today);

  const criteria: SchedulingCriteria = {
    kind: b.orDefault(
      "kind",
      kind === "one_off"
        ? "one-off"
        : kind === "recurring"
          ? "recurring"
          : null,
      defaults.kind
    ),
    durationMinutes: b.required(
      "durationMinutes",
      duration == null ? null : Number(duration)
    ),
    startDate: b.orDefault(
      "startDate",
      period?.[0] ?? null,
      defaults.startDate
    ),
    endDate: b.orDefault("endDate", period?.[1] ?? null, defaults.endDate),
    everyNWeeks: b.orDefault(
      "everyNWeeks",
      frequency == null ? null : (FREQUENCIES[frequency] ?? null),
      defaults.everyNWeeks
    ),
    occurrences: null,
    weekdays: b.orDefault(
      "weekdays",
      resolveWeekdays(b, answers),
      defaults.weekdays
    ),
    preferredWindow: window == null ? null : (WINDOWS[window] ?? null)
  };
  // 回数は定期のときだけ必須。
  criteria.occurrences =
    criteria.kind === "recurring"
      ? b.required(
          "occurrences",
          occurrences == null ? null : Number(occurrences)
        )
      : occurrences == null
        ? null
        : Number(occurrences);
  // 単発ではフォームに出ない定期だけの項目は、確からしさが低くても確認させない。
  if (criteria.kind !== "recurring") {
    b.review.delete("occurrences");
    b.review.delete("everyNWeeks");
  }

  return {
    criteria,
    review: [...b.review],
    defaulted: [...b.defaulted],
    failed: false
  };
}
