// =============================================================================
// client/hooks/useCriteriaDraft
// 調整条件フォームの状態と、Jev による下書き（docs/adr/0003）。
// 下書きを作るとフォームを置き換え、各項目に印（要確認・既定値）を付ける。
// ユーザーが項目を編集したら、その項目の印は外す。
// =============================================================================

import { useState } from "react";
import {
  defaultCriteria,
  todayInTimeZone,
  type CriteriaDraft,
  type CriteriaField,
  type SchedulingCriteria
} from "../../shared/criteria";
import type { CriteriaMarks } from "../components/CriteriaForm";
import { requestDraft } from "../lib/suggest";

function marksOf(draft: CriteriaDraft): CriteriaMarks {
  const marks: CriteriaMarks = {};
  draft.defaulted.forEach((f) => (marks[f] = "defaulted"));
  // 要確認は既定値より優先して見せる。
  draft.review.forEach((f) => (marks[f] = "review"));
  return marks;
}

export function useCriteriaDraft() {
  const [criteria, setCriteria] = useState<SchedulingCriteria>(() =>
    defaultCriteria(todayInTimeZone())
  );
  const [marks, setMarks] = useState<CriteriaMarks>({});
  const [failed, setFailed] = useState(false);
  const [drafting, setDrafting] = useState(false);

  /** フォームの編集。値が変わった項目の印を外す。 */
  const edit = (next: SchedulingCriteria) => {
    const changed = (Object.keys(next) as CriteriaField[]).filter(
      (f) => JSON.stringify(next[f]) !== JSON.stringify(criteria[f])
    );
    setMarks((prev) => {
      const rest = { ...prev };
      changed.forEach((f) => delete rest[f]);
      return rest;
    });
    setCriteria(next);
  };

  const makeDraft = async (details: string) => {
    setDrafting(true);
    try {
      const draft = await requestDraft(details);
      setCriteria(draft.criteria);
      setMarks(marksOf(draft));
      setFailed(draft.failed);
    } catch {
      setFailed(true);
    } finally {
      setDrafting(false);
    }
  };

  return { criteria, edit, marks, failed, drafting, makeDraft };
}
