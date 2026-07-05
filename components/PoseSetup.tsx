"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import type { ExerciseDef } from "@/types";
import { POSE_EXERCISES } from "@/lib/pose/exercises";

type PoseExerciseId = ExerciseDef["id"];
type TrackedSide = ExerciseDef["side"];

interface PoseSetupProps {
  exerciseId: PoseExerciseId;
  side: TrackedSide;
  onExerciseChange: (id: PoseExerciseId) => void;
  onSideChange: (side: TrackedSide) => void;
  /** Disable while tracking is live so the counter isn't reset mid-set by accident. */
  disabled?: boolean;
}

const SIDE_OPTIONS: { value: TrackedSide; label: string; hint: string }[] = [
  { value: "left", label: "My left side", hint: "Track my left arm" },
  { value: "either", label: "Either side", hint: "Whichever is easier" },
  { value: "right", label: "My right side", hint: "Track my right arm" },
];

const cardClass =
  "group flex min-h-12 flex-1 items-center justify-between gap-3 rounded-2xl border-2 border-line-strong bg-surface px-4 py-2 text-left transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-evergreen data-[state=checked]:bg-mint";

/** A checkmark that appears only for the chosen option, so selection is shown
 * by an icon and not by color alone (AGENTS.md §6, rule 5). The unchosen
 * options show an empty ring in the same spot, so the layout never shifts. */
function SelectedMark() {
  return (
    <>
      <span
        aria-hidden="true"
        className="h-6 w-6 shrink-0 rounded-full border-2 border-line-strong group-data-[state=checked]:hidden"
      />
      <RadioGroup.Indicator className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-milk">
        <Check aria-hidden="true" className="h-4 w-4" />
      </RadioGroup.Indicator>
    </>
  );
}

/**
 * Setup controls for the hands-free tracker (T13): pick which movement to count
 * and which side of the body to track. Single-limb support is a first-class
 * choice here so a user with a limb difference or one-sided range tracks the
 * side they actually move — never both compared against each other
 * (AGENTS.md §5b). Two native radio groups, each fully keyboard operable.
 */
export function PoseSetup({
  exerciseId,
  side,
  onExerciseChange,
  onSideChange,
  disabled = false,
}: PoseSetupProps) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card">
      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="font-display text-lg font-bold text-ink">
          Which movement?
        </legend>
        <RadioGroup.Root
          value={exerciseId}
          onValueChange={(next) => onExerciseChange(next as PoseExerciseId)}
          aria-label="Which movement to track"
          className="flex flex-col gap-3 min-[420px]:flex-row lg:flex-col min-[1200px]:flex-row"
          disabled={disabled}
        >
          {POSE_EXERCISES.map((exercise) => (
            <RadioGroup.Item
              key={exercise.id}
              value={exercise.id}
              className={cardClass}
            >
              <span className="text-lg font-semibold text-ink">
                {exercise.name}
              </span>
              <SelectedMark />
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="font-display text-lg font-bold text-ink">
          Which side are you moving?
        </legend>
        <RadioGroup.Root
          value={side}
          onValueChange={(next) => onSideChange(next as TrackedSide)}
          aria-label="Which side of your body to track"
          className="flex flex-col gap-3"
          disabled={disabled}
        >
          {SIDE_OPTIONS.map((option) => (
            <RadioGroup.Item
              key={option.value}
              value={option.value}
              className={cardClass}
            >
              <span className="flex flex-col">
                <span className="text-lg font-semibold text-ink">
                  {option.label}
                </span>
                <span className="text-base text-ink-soft">{option.hint}</span>
              </span>
              <SelectedMark />
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </fieldset>
    </section>
  );
}
