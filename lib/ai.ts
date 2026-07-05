import {
  WorkoutSchema,
  type Abilities,
  type EnergyLevel,
  type Exercise,
  type Workout,
} from "@/types";
import {
  EXERCISES,
  filterExercisesForAbilities,
  pickExercisesForEnergy,
  stepCountForEnergy,
} from "@/lib/exercises";

interface GenerateWorkoutArgs {
  abilities: Abilities;
  energy: EnergyLevel;
  recentSessionIds: string[];
}

/**
 * Client helper for F4. Calls the server route handler; on any failure
 * (network, non-2xx, invalid JSON) falls back to a deterministic filter
 * so the demo path never breaks (Section 5, "Fallback").
 */
export async function generateWorkout({
  abilities,
  energy,
  recentSessionIds,
}: GenerateWorkoutArgs): Promise<Workout> {
  try {
    const response = await fetch("/api/generate-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: { abilities },
        energy,
        recent_session_ids: recentSessionIds,
      }),
    });

    if (!response.ok) {
      throw new Error(`generate-workout returned ${response.status}`);
    }

    const parsed = WorkoutSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("generate-workout returned invalid workout shape");
    }

    return parsed.data;
  } catch {
    return buildFallbackWorkout({ abilities, energy });
  }
}

/** Deterministic filter fallback (Section 5): position ∩ equipment, sorted by
 * intensity, take N by energy. No LLM call, no network dependency. */
export function buildFallbackWorkout({
  abilities,
  energy,
}: {
  abilities: Abilities;
  energy: EnergyLevel;
}): Workout {
  const candidates = filterExercisesForAbilities(abilities, EXERCISES);
  const stepCount = stepCountForEnergy(energy);
  const chosen: Exercise[] = pickExercisesForEnergy(candidates, stepCount);

  const durationSeconds = energy <= 2 ? 30 : 45;
  const restSeconds = energy <= 2 ? 60 : 30;

  return {
    title: energy <= 2 ? "Gentle Reset" : "Steady Progress",
    estimated_minutes: Math.max(
      5,
      Math.round((chosen.length * (durationSeconds + restSeconds)) / 60),
    ),
    energy_level: energy,
    steps: chosen.map((exercise) => {
      const usesTimedMetric =
        exercise.tracking_modes.includes("timer") ||
        exercise.metric_logged === "session_duration" ||
        exercise.metric_logged === "duration_per_stretch" ||
        exercise.metric_logged === "duration_effort" ||
        exercise.metric_logged === "distance_time" ||
        exercise.metric_logged === "laps_duration";

      return {
        exercise_id: exercise.id,
        duration_seconds: durationSeconds,
        reps: usesTimedMetric ? null : energy <= 2 ? 6 : 10,
        rest_after_seconds: restSeconds,
        adaptation_note: "Go at your own pace — skipping is always okay.",
      };
    }),
  };
}
