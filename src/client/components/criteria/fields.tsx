// =============================================================================
// client/components/criteria/fields
// 調整条件フォームの入力部品（ラベル付き）。
// =============================================================================

const inputClass =
  "w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-2 py-1 text-kumo-default focus:outline-none focus:ring-1 focus:ring-kumo-accent";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function Label({ text }: { text: string }) {
  return <span className="block text-xs text-kumo-subtle mb-1">{text}</span>;
}

/** 数値欄。空欄は null として扱う。 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label text={label} />
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
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label text={label} />
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
  onChange
}: {
  label: string;
  value: string;
  options: [value: string, label: string][];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label text={label} />
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
  onChange
}: {
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
    <div className="col-span-2">
      <Label text="曜日" />
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
