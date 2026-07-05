import {
  WorkoutSchema,
  type Abilities,
  type EnergyLevel,
  type Workout,
} from "@/types";
import { buildFallbackWorkout } from "@/lib/workoutFallback";

export { buildFallbackWorkout } from "@/lib/workoutFallback";

const GENERATE_WORKOUT_TIMEOUT_MS = 4000;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GENERATE_WORKOUT_TIMEOUT_MS,
  );

  try {
    const response = await fetch("/api/generate-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}
