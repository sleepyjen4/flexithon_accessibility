import type { Abilities, EnergyLevel, Exercise, Workout } from "@/types";
import {
  EXERCISES,
  filterExercisesForAbilities,
  pickExercisesForEnergy,
  stepCountForEnergy,
} from "@/lib/exercises";

function timingForEnergy(energy: number) {
  return {
    durationSeconds: energy <= 2 ? 30 : 45,
    restSeconds: energy <= 2 ? 60 : 30,
  };
}

/**
 * A profile can filter the library down to nothing — avoid every body region
 * and 0 of 46 exercises survive. That used to produce a workout with no steps,
 * which the player read as "already finished" and celebrated. Telling someone
 * they completed a workout that never existed is the worst thing this app can
 * do, so the empty case is in the return type: there is no way to reach
 * `.workout` without having checked `ok` first.
 */
export type WorkoutBuildResult =
  | { ok: true; workout: Workout }
  | { ok: false; reason: "no_exercises_available" };

/**
 * Deterministic and pure: sorted by intensity, scaled by energy, hero exercise
 * guaranteed by `pickExercisesForEnergy`.
 *
 * This used to be the fallback behind a Gemini route handler. The route was
 * removed because it never reached a user: the client aborted at 4000ms while
 * live calls measured 8.8-13.6s, so every workout ever generated came from
 * here. Nothing calls a model at runtime now, which is what makes generation
 * instant and its output reproducible from (abilities, energy) alone — the
 * property /workout relies on to rebuild after a refresh.
 */
function buildWorkoutForExercises(
  availableExercises: Exercise[],
  energy: number,
): Workout {
  const chosen = pickExercisesForEnergy(
    availableExercises,
    stepCountForEnergy(energy),
  );
  const { durationSeconds, restSeconds } = timingForEnergy(energy);

  return {
    title: energy <= 2 ? "Gentle Reset" : "Steady Progress",
    estimated_minutes: Math.max(
      5,
      Math.round((chosen.length * (durationSeconds + restSeconds)) / 60),
    ),
    energy_level: energy,
    steps: chosen.map((exercise) => ({
      exercise_id: exercise.id,
      duration_seconds: durationSeconds,
      reps: null,
      rest_after_seconds: restSeconds,
      adaptation_note: "Go at your own pace — skipping is always okay.",
    })),
  };
}

/** Today's workout for a profile. Same inputs always give the same workout. */
export function buildWorkout({
  abilities,
  energy,
}: {
  abilities: Abilities;
  energy: EnergyLevel;
}): WorkoutBuildResult {
  const available = filterExercisesForAbilities(abilities, EXERCISES);
  if (available.length === 0) return { ok: false, reason: "no_exercises_available" };

  return { ok: true, workout: buildWorkoutForExercises(available, energy) };
}

/** True when a profile leaves the library empty — lets onboarding warn before
 * the user reaches the dashboard and finds the button cannot do anything. */
export function hasAvailableExercises(abilities: Abilities): boolean {
  return filterExercisesForAbilities(abilities, EXERCISES).length > 0;
}
