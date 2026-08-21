import { ClipboardList } from "lucide-react";
import type { Exercise } from "@/types";
import { EXERCISE_METRIC_LABELS } from "@/lib/exercises";
import { getExerciseVideoUrl } from "@/lib/exerciseVideos";
import { ExerciseDemo } from "@/components/ExerciseDemo";

interface ExerciseVisualProps {
  exercise: Exercise;
  /** Passed through to ExerciseDemo: false inside a card that is itself a link,
   * so no interactive element nests inside another. */
  interactive?: boolean;
  className?: string;
}

/**
 * The single place that decides what an exercise shows above its instructions.
 *
 * Every exercise has a demo clip except the `manual_entry` ones — swimming,
 * walking with a mobility aid — and those are activities you log after the
 * fact, not movements you copy from a loop. A demo was never the right
 * affordance for them, so they get a card that says what they actually are
 * instead of the blank space a missing clip used to leave.
 *
 * `lib/exercises.test.ts` holds the other half of this: any exercise that is
 * NOT manual_entry must have a clip, so a content gap can never quietly come
 * back as an empty slot.
 */
export function ExerciseVisual({
  exercise,
  interactive = true,
  className = "",
}: ExerciseVisualProps) {
  const videoUrl = getExerciseVideoUrl(exercise.id);

  if (videoUrl) {
    return (
      <ExerciseDemo
        videoUrl={videoUrl}
        name={exercise.name}
        interactive={interactive}
        className={className}
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl bg-lavender p-5 ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-[#4f4a78]"
      >
        <ClipboardList className="h-6 w-6" />
      </span>
      <span>
        <span className="block font-display text-lg font-bold text-ink">
          You log this one
        </span>
        <span className="block text-base leading-6 text-ink">
          {EXERCISE_METRIC_LABELS[exercise.metric_logged]}, recorded in your own
          words when you finish.
        </span>
      </span>
    </div>
  );
}
