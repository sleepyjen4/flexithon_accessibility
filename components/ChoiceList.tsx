"use client";

import { Check, Plus, type LucideIcon } from "lucide-react";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Leading icon so a list of options reads at a glance, not just as text. */
  icon?: LucideIcon;
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
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(option.value)}
            className={`group flex min-h-14 w-full items-center justify-between gap-4 rounded-full border-2 px-5 py-3 text-left transition-colors ${
              isSelected
                ? "border-raspberry bg-raspberry-soft"
                : "border-line-strong bg-surface hover:border-raspberry/50 hover:bg-raspberry-soft/60"
            }`}
          >
            <span className="flex items-center gap-4">
              {Icon ? (
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isSelected
                      ? "bg-raspberry text-milk"
                      : "bg-cream text-ink-soft group-hover:bg-transparent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              ) : null}
              <span className="flex flex-col">
                <span className="text-lg font-bold text-ink">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="text-base text-ink-soft">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
                isSelected
                  ? "border-raspberry bg-raspberry text-milk"
                  : "border-line-strong text-ink-soft"
              }`}
            >
              {isSelected ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
