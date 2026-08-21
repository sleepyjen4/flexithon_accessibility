import type { Abilities, EnergyLevel, Exercise, Workout } from "@/types";
import {
  EXERCISES,
  filterExercisesForAbilities,
  isPlayableInWorkout,
  pickExercisesForEnergy,
} from "@/lib/exercises";

/**
 * The exercises a profile can actually be given as workout steps.
 *
 * `buildWorkout` and `hasAvailableExercises` must agree on this set or
 * onboarding waves through a profile the dashboard then refuses to build for,
 * so they share one definition rather than each filtering for themselves.
 */
function playableExercisesFor(abilities: Abilities): Exercise[] {
  return filterExercisesForAbilities(abilities, EXERCISES).filter(
    isPlayableInWorkout,
  );
}

/**
 * Work rises and rest falls across the whole scale, but never fast enough to
 * cancel each other out.
 *
 * The old pair (30s/60s below energy 3, 45s/30s above) made per-step time fall
 * from 90s to 75s as energy rose, so the extra steps were spent buying back
 * time the timing change had just removed: energy 1-3 all estimated 6 minutes
 * and energy 2 to 3 was a 15-second difference across the entire low-to-medium
 * boundary. These five pairs give five distinct, monotonic session lengths —
 * roughly 4.5, 5.7, 6.7, 8.0 and 10.7 minutes.
 */
const TIMING_BY_ENERGY: Record<
  EnergyLevel,
  { durationSeconds: number; restSeconds: number }
> = {
  1: { durationSeconds: 30, restSeconds: 60 },
  2: { durationSeconds: 35, restSeconds: 50 },
  3: { durationSeconds: 40, restSeconds: 40 },
  4: { durationSeconds: 45, restSeconds: 35 },
  5: { durationSeconds: 50, restSeconds: 30 },
};

/** One title per level, so the plan names the day rather than one of two moods. */
const TITLE_BY_ENERGY: Record<EnergyLevel, string> = {
  1: "Gentle Reset",
  2: "Quiet Start",
  3: "Steady Progress",
  4: "Building Strength",
  5: "Full Effort",
};

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
 * Deterministic and pure: the step count, the intensity ceiling and the hero
 * guarantee all live in `pickExercisesForEnergy`; the timing lives here.
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
  energy: EnergyLevel,
): Workout {
  const chosen = pickExercisesForEnergy(availableExercises, energy);
  const { durationSeconds, restSeconds } = TIMING_BY_ENERGY[energy];

  return {
    title: TITLE_BY_ENERGY[energy],
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
  const available = playableExercisesFor(abilities);
  if (available.length === 0)
    return { ok: false, reason: "no_exercises_available" };

  return { ok: true, workout: buildWorkoutForExercises(available, energy) };
}

/** True when a profile leaves the library empty — lets onboarding warn before
 * the user reaches the dashboard and finds the button cannot do anything. */
export function hasAvailableExercises(abilities: Abilities): boolean {
  return playableExercisesFor(abilities).length > 0;
}
