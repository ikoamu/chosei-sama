// =============================================================================
// client/components/CriteriaForm
// 調整条件のフォーム（docs/adr/0003）。
//   - 必須: 所要時間、（定期なら）回数。空なら送れない
//   - 既定あり: 検索期間/開始日、単発/定期、頻度、曜日（既定値で埋めて表示）
//   - 任意: 希望時間帯（ランキングを上げるだけ）
// =============================================================================

import type { SchedulingCriteria } from "../../shared/criteria";
import {
  DateField,
  NumberField,
  SelectField,
  WeekdayField
} from "./criteria/fields";

type Patch = (patch: Partial<SchedulingCriteria>) => void;

/** 定期のときだけの項目（頻度・回数）。 */
function RecurringFields({
  criteria,
  set
}: {
  criteria: SchedulingCriteria;
  set: Patch;
}) {
  return (
    <>
      <SelectField
        label="頻度"
        value={String(criteria.everyNWeeks)}
        options={[
          ["1", "毎週"],
          ["2", "隔週"],
          ["4", "4週ごと"]
        ]}
        onChange={(v) => set({ everyNWeeks: Number(v) })}
      />
      <NumberField
        label="回数 ※必須"
        min={1}
        value={criteria.occurrences}
        onChange={(occurrences) => set({ occurrences })}
      />
    </>
  );
}

/** 希望時間帯（任意）。片方だけ入れたら、もう片方は勤務時間の端で補う。 */
function PreferredWindowFields({
  criteria,
  set
}: {
  criteria: SchedulingCriteria;
  set: Patch;
}) {
  const w = criteria.preferredWindow;
  return (
    <>
      <NumberField
        label="希望時間帯（任意・開始時）"
        min={0}
        max={23}
        value={w?.startHour ?? null}
        onChange={(startHour) =>
          set({
            preferredWindow:
              startHour == null
                ? null
                : { startHour, endHour: w?.endHour ?? 18 }
          })
        }
      />
      <NumberField
        label="希望時間帯（任意・終了時）"
        min={0}
        max={23}
        value={w?.endHour ?? null}
        onChange={(endHour) =>
          set({
            preferredWindow:
              endHour == null ? null : { startHour: w?.startHour ?? 9, endHour }
          })
        }
      />
    </>
  );
}

export function CriteriaForm({
  criteria,
  onChange,
  disabled
}: {
  criteria: SchedulingCriteria;
  onChange: (c: SchedulingCriteria) => void;
  disabled: boolean;
}) {
  const set: Patch = (patch) => onChange({ ...criteria, ...patch });
  const recurring = criteria.kind === "recurring";

  return (
    <fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
      <SelectField
        label="種類"
        value={criteria.kind}
        options={[
          ["one-off", "単発"],
          ["recurring", "定期"]
        ]}
        onChange={(v) => set({ kind: v as SchedulingCriteria["kind"] })}
      />
      <NumberField
        label="所要時間（分）※必須"
        min={1}
        value={criteria.durationMinutes}
        onChange={(durationMinutes) => set({ durationMinutes })}
      />
      <DateField
        label={recurring ? "開始日" : "検索期間の開始日"}
        value={criteria.startDate}
        onChange={(startDate) => set({ startDate })}
      />
      {recurring ? (
        <RecurringFields criteria={criteria} set={set} />
      ) : (
        <DateField
          label="検索期間の終了日"
          value={criteria.endDate}
          onChange={(endDate) => set({ endDate })}
        />
      )}
      <WeekdayField
        value={criteria.weekdays}
        onChange={(weekdays) => set({ weekdays })}
      />
      <PreferredWindowFields criteria={criteria} set={set} />
    </fieldset>
  );
}
