"use client";

import { useEffect } from "react";
import type { Workout } from "@/types";
import { useSessionStore } from "@/store/session";
import { WorkoutPlayer } from "@/components/WorkoutPlayer";

interface WorkoutSessionLoaderProps {
  workout: Workout;
}

export function WorkoutSessionLoader({ workout }: WorkoutSessionLoaderProps) {
  const activeWorkout = useSessionStore((state) => state.workout);
  const setWorkout = useSessionStore((state) => state.setWorkout);

  useEffect(() => {
    setWorkout(workout);
  }, [setWorkout, workout]);

  if (activeWorkout !== workout) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Loading exercise
        </h1>
        <p className="text-lg text-slate-600" aria-live="polite">
          Preparing the workout player.
        </p>
      </div>
    );
  }

  return <WorkoutPlayer />;
}
