// =============================================================================
// server/jev
// 条件欄の文章から、Jev で調整条件の下書きを作る（docs/adr/0003）。
// Jev へ送るのは伏せ字にした条件欄の文章だけ。
// Jev が失敗しても調整は止めず、既定値の下書きを全項目要確認で返して手入力させる。
// =============================================================================

import {
  defaultCriteria,
  type CriteriaDraft,
  type CriteriaField
} from "../../shared/criteria";
import { askJev } from "./client";
import { draftFromAnswers } from "./draft";
import { maskEmails } from "./mask";
import { DRAFT_QUESTIONS } from "./questions";

/** today は Asia/Tokyo の今日（YYYY-MM-DD）。 */
export async function draftCriteria(
  apiKey: string,
  details: string,
  today: string
): Promise<CriteriaDraft> {
  try {
    const answers = await askJev(apiKey, maskEmails(details), DRAFT_QUESTIONS);
    return draftFromAnswers(answers, today);
  } catch (err) {
    console.error("[draftCriteria] jev failed:", err);
    const criteria = defaultCriteria(today);
    return {
      criteria,
      review: Object.keys(criteria) as CriteriaField[],
      defaulted: [],
      failed: true
    };
  }
}
