// =============================================================================
// server/jev/questions
// 調整条件の下書きを作るために Jev へ送る質問（1 回の呼び出しでまとめて送る）。
// Jev は値を自由に抜き出せないため、すべて選択肢（Choice）か はい/いいえ（Noul）。
// 「該当なし（none）」は先頭に寄る癖を避けるため、選択肢の最後に置く。
// 質問のキーと選択肢の値は draft.ts の変換と対応している。
// =============================================================================

const NONE = { none: "文中に該当する指定がない" };

/** 値そのものを選択肢名にする（説明なし）。 */
function options(values: string[]): Record<string, null> {
  return Object.fromEntries(values.map((v) => [v, null]));
}

function range(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export const DRAFT_QUESTIONS = {
  kind: {
    type: "choice",
    instructions: "会議は1回だけか、定期的に繰り返すか",
    criteria: {
      one_off: "1回だけの会議",
      recurring: "毎週・隔週・定例など繰り返し開催",
      unclear: "どちらとも読み取れない"
    }
  },
  duration: {
    type: "choice",
    instructions: "1回あたりの会議の長さ（分）",
    criteria: { ...options(["15", "30", "45", "60", "90", "120"]), ...NONE }
  },
  frequency: {
    type: "choice",
    instructions: "繰り返しの頻度",
    criteria: {
      weekly: "毎週",
      biweekly: "隔週（2週に1回）",
      every4weeks: "4週ごと・月1回",
      ...NONE
    }
  },
  occurrences: {
    type: "choice",
    instructions: "開催回数として明示された回数",
    criteria: { ...options(range(1, 12)), ...NONE }
  },
  anchor: {
    type: "choice",
    instructions: "候補を探す期間・開始時期の指定",
    criteria: {
      today: "今日",
      this_week: "今週",
      next_week: "来週",
      this_month: "今月",
      next_month: "来月（来月開始・来月中など）",
      within_days: "直近◯日・◯日以内など、今日からの日数",
      date: "具体的な日付（11/4 など）",
      ...NONE
    }
  },
  within_days: {
    type: "choice",
    instructions: "今日から何日以内か",
    criteria: {
      "3": "3日",
      "7": "1週間・7日",
      "14": "2週間・14日",
      "30": "1か月・30日",
      ...NONE
    }
  },
  month: {
    type: "choice",
    instructions: "指定された日付の月",
    criteria: { ...options(range(1, 12)), ...NONE }
  },
  day: {
    type: "choice",
    instructions: "指定された日付の日",
    criteria: { ...options(range(1, 31)), ...NONE }
  },
  window: {
    type: "choice",
    instructions: "希望する時間帯",
    criteria: { morning: "午前", afternoon: "午後", evening: "夕方", ...NONE }
  },
  // 「○曜日に開催したい」と問うと「火曜か木曜」の「か」を迷いと読んで低く出るため、
  // 文中に希望として挙がっているかを問う（接続確認で 0.28 → 0.96 に改善）。
  ...Object.fromEntries(
    WEEKDAY_NAMES.map((d, i) => [
      `wd${i}`,
      {
        type: "noul",
        instructions: `文中で「${d}曜」または「${d}曜日」が希望する曜日として挙げられている`
      }
    ])
  )
};
