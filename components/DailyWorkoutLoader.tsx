"use client";

import { useEffect } from "react";
import { buildWorkout } from "@/lib/workoutBuilder";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";
import { WorkoutPlayer } from "@/components/WorkoutPlayer";

/**
 * Restores today's workout on /workout after a refresh.
 *
 * `store/session` deliberately does not persist the workout: restoring a
 * half-finished session days later would drop the user mid-workout with no
 * context. That objection still stands, so this does not restore progress — it
 * rebuilds the workout and starts it at step one.
 *
 * Rebuilding is only possible because generation is deterministic and local:
 * the same abilities and energy always produce the same workout, so there is
 * nothing to store. Without a saved check-in there is nothing to rebuild from
 * either, and WorkoutPlayer's own empty state (which points at /dashboard)
 * is the right answer.
 *
 * Only /workout mounts this. /exercise/[exerciseId] has its own loader for the
 * single-exercise workouts it builds, and running both would race.
 */
export function DailyWorkoutLoader() {
  const workout = useSessionStore((state) => state.workout);
  const setWorkout = useSessionStore((state) => state.setWorkout);
  const abilities = useProfileStore((state) => state.abilities);
  const todaysEnergy = useProfileStore((state) => state.todaysEnergy);

  useEffect(() => {
    if (workout || !abilities || todaysEnergy === null) return;

    const result = buildWorkout({ abilities, energy: todaysEnergy });
    if (result.ok) setWorkout(result.workout);
  }, [workout, abilities, todaysEnergy, setWorkout]);

  return <WorkoutPlayer />;
}
