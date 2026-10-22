// =============================================================================
// client/components/criteria/fields
// 調整条件フォームの入力部品（ラベル付き）。
// 下書きの印（要確認・既定値）を受け取り、要確認は黄色の枠で強調する。
// =============================================================================

/** 下書きでの項目の印。要確認＝確からしさが低い・欠けた必須、既定値＝文中に指定なし。 */
export type FieldMark = "review" | "defaulted";

const inputClass =
  "w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-2 py-1 text-kumo-default focus:outline-none focus:ring-1 focus:ring-kumo-accent";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function Label({ text, mark }: { text: string; mark?: FieldMark }) {
  return (
    <span className="block text-xs text-kumo-subtle mb-1">
      {text}
      {mark === "review" && (
        <span className="ml-1 font-semibold text-amber-600">要確認</span>
      )}
      {mark === "defaulted" && <span className="ml-1">（既定値）</span>}
    </span>
  );
}

/** 要確認の項目を囲む枠。 */
function markClass(mark?: FieldMark): string {
  return mark === "review"
    ? "rounded-lg ring-2 ring-amber-400 ring-offset-2"
    : "";
}

/** 数値欄。空欄は null として扱う。 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  mark
}: {
  label: string;
  mark?: FieldMark;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className={markClass(mark)}>
      <Label text={label} mark={mark} />
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        className={inputClass}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  mark
}: {
  label: string;
  mark?: FieldMark;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={markClass(mark)}>
      <Label text={label} mark={mark} />
      <input
        type="date"
        aria-label={label}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  mark
}: {
  label: string;
  mark?: FieldMark;
  value: string;
  options: [value: string, label: string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className={markClass(mark)}>
      <Label text={label} mark={mark} />
      <select
        aria-label={label}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 曜日のトグル（0=日 … 6=土）。 */
export function WeekdayField({
  value,
  onChange,
  mark
}: {
  mark?: FieldMark;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const toggle = (d: number) =>
    onChange(
      value.includes(d)
        ? value.filter((w) => w !== d)
        : [...value, d].sort((a, b) => a - b)
    );
  return (
    <div className={`col-span-2 ${markClass(mark)}`}>
      <Label text="曜日" mark={mark} />
      <div className="flex gap-1">
        {WEEKDAY_LABELS.map((label, d) => (
          <button
            key={label}
            type="button"
            aria-pressed={value.includes(d)}
            onClick={() => toggle(d)}
            className={`w-8 h-8 rounded-md border text-xs ${
              value.includes(d)
                ? "bg-[#07AF4A] text-white border-[#07AF4A]"
                : "border-kumo-line text-kumo-default"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
