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
 * The workout generator (F4). Deterministic and pure: sorted by intensity,
 * scaled by energy, hero exercise guaranteed by `pickExercisesForEnergy`.
 *
 * This used to be the fallback behind a Gemini route handler. The route was
 * removed because it never reached a user: the client aborted at 4000ms while
 * live calls measured 8.8-13.6s, so every workout ever generated came from
 * here. Nothing calls a model at runtime now, which is what makes generation
 * instant and its output reproducible from (abilities, energy) alone.
 */
export function buildWorkoutForExercises(
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

export function buildWorkout({
  abilities,
  energy,
}: {
  abilities: Abilities;
  energy: EnergyLevel;
}): Workout {
  return buildWorkoutForExercises(
    filterExercisesForAbilities(abilities, EXERCISES),
    energy,
  );
}
