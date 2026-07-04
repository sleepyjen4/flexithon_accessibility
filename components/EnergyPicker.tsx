"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import type { EnergyLevel } from "@/types";

const LEVELS: { value: EnergyLevel; label: string; hint: string }[] = [
  { value: 1, label: "Running on empty", hint: "Rest-first movement" },
  { value: 2, label: "Low", hint: "Short and gentle" },
  { value: 3, label: "Okay", hint: "A steady session" },
  { value: 4, label: "Good", hint: "Room to work" },
  { value: 5, label: "Charged up", hint: "Bring it on" },
];

interface EnergyPickerProps {
  value: EnergyLevel | null;
  onChange: (value: EnergyLevel) => void;
}

/** F3: 1-5 battery scale, spoon-theory inspired. One tap, done. */
export function EnergyPicker({ value, onChange }: EnergyPickerProps) {
  return (
    <RadioGroup.Root
      value={value ? String(value) : undefined}
      onValueChange={(next) => onChange(Number(next) as EnergyLevel)}
      aria-label="Today's energy level, from 1 (running on empty) to 5 (charged up)"
      className="flex flex-col gap-3"
    >
      {LEVELS.map((level) => (
        <RadioGroup.Item
          key={level.value}
          value={String(level.value)}
          className="flex min-h-14 w-full items-center gap-4 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-50"
        >
          <span
            aria-hidden="true"
            className="flex h-8 items-end gap-0.5 rounded border-2 border-slate-500 p-0.5"
          >
            {[1, 2, 3, 4, 5].map((segment) => (
              <span
                key={segment}
                className={`h-full w-2 rounded-sm ${
                  segment <= level.value ? "bg-indigo-600" : "bg-slate-200"
                }`}
              />
            ))}
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-semibold text-slate-900">
              {level.value} — {level.label}
            </span>
            <span className="text-base text-slate-600">{level.hint}</span>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
