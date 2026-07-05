import type { Abilities, EnergyLevel, Exercise, Workout } from "@/types";
import {
  EXERCISES,
  filterExercisesForAbilities,
  pickExercisesForEnergy,
  stepCountForEnergy,
} from "@/lib/exercises";

function fallbackTimingForEnergy(energy: number) {
  return {
    durationSeconds: energy <= 2 ? 30 : 45,
    restSeconds: energy <= 2 ? 60 : 30,
  };
}

/** Deterministic fallback (Section 5): sorted by intensity, scaled by energy. */
export function buildFallbackWorkoutForExercises(
  availableExercises: Exercise[],
  energy: number,
): Workout {
  const chosen = pickExercisesForEnergy(
    availableExercises,
    stepCountForEnergy(energy),
  );
  const { durationSeconds, restSeconds } = fallbackTimingForEnergy(energy);

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

export function buildFallbackWorkout({
  abilities,
  energy,
}: {
  abilities: Abilities;
  energy: EnergyLevel;
}): Workout {
  return buildFallbackWorkoutForExercises(
    filterExercisesForAbilities(abilities, EXERCISES),
    energy,
  );
}