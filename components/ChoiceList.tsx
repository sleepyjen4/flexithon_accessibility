"use client";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface ChoiceListProps<T extends string> {
  legend: string;
  options: ChoiceOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}

/** Multi-select list of big toggle buttons (F1 onboarding). Real <button>s
 * with aria-pressed; selection is shown by border, background AND a text
 * mark — never color alone. */
export function ChoiceList<T extends string>({
  legend,
  options,
  selected,
  onToggle,
}: ChoiceListProps<T>) {
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(option.value)}
            className={`flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              isSelected
                ? "border-indigo-600 bg-indigo-50"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
          >
            <span className="flex flex-col">
              <span className="text-lg font-semibold text-slate-900">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-base text-slate-600">
                  {option.description}
                </span>
              ) : null}
            </span>
            <span
              className={`text-xl font-bold ${
                isSelected ? "text-indigo-700" : "text-slate-300"
              }`}
              aria-hidden="true"
            >
              {isSelected ? "✓" : "+"}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
