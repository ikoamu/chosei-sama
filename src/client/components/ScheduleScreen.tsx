// =============================================================================
// client/components/ScheduleScreen
// メイン画面。参加者（ピッカー）を選び、調整条件を自然文から下書き（Jev）して
// フォームで確定し、候補提案 API の結果を表示する（docs/adr/0003）。
// =============================================================================

import { useState } from "react";
import { Button } from "@cloudflare/kumo";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import {
  missingRequired,
  type SchedulingCriteria,
  type SuggestResult
} from "../../shared/criteria";
import type { Participant } from "../../shared/booking";
import { useParticipantPicker } from "../hooks/useParticipantPicker";
import { useCriteriaDraft } from "../hooks/useCriteriaDraft";
import { requestSuggest } from "../lib/suggest";
import { AppHeader } from "./AppHeader";
import { ParticipantPicker } from "./ParticipantPicker";
import { CriteriaForm } from "./CriteriaForm";
import { DraftInput } from "./criteria/DraftInput";
import { SuggestResultView } from "./SuggestResultView";

export function ScheduleScreen({ user }: { user: AuthUser }) {
  const picker = useParticipantPicker(user);
  const draft = useCriteriaDraft();
  const { criteria } = draft;
  // 結果と、その結果を出したときの入力（以後フォームを編集しても予約はこちらを使う）。
  const [result, setResult] = useState<{
    suggest: SuggestResult;
    criteria: SchedulingCriteria;
    participants: Participant[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = !loading && missingRequired(criteria).length === 0;

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const participants = picker.selected.map(({ email, name }) => ({
      email,
      name
    }));
    try {
      const suggest = await requestSuggest(
        participants.map((p) => p.email),
        criteria
      );
      setResult({ suggest, criteria, participants });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kumo-elevated">
      <AppHeader user={user} />
      <main className="max-w-xl mx-auto px-5 py-6 space-y-6">
        <ParticipantPicker self={user} picker={picker} disabled={loading} />
        <DraftInput
          drafting={draft.drafting}
          failed={draft.failed}
          disabled={loading}
          onDraft={draft.makeDraft}
        />
        <CriteriaForm
          criteria={criteria}
          onChange={draft.edit}
          disabled={loading || draft.drafting}
          marks={draft.marks}
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            icon={<MagnifyingGlassIcon size={16} />}
            disabled={!canSubmit}
            onClick={submit}
          >
            {loading ? "探しています…" : "候補を探す"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <SuggestResultView
            result={result.suggest}
            criteria={result.criteria}
            participants={result.participants}
          />
        )}
      </main>
    </div>
  );
}
