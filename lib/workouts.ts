import type { EnergyLevel, Exercise, Workout, WorkoutStep } from "@/types";

const TIMED_METRICS = new Set([
  "session_duration",
  "duration_per_stretch",
  "duration_effort",
  "distance_time",
  "laps_duration",
]);

export function exerciseUsesTimedMetric(exercise: Exercise): boolean {
  return (
    exercise.tracking_modes.includes("timer") ||
    TIMED_METRICS.has(exercise.metric_logged)
  );
}

export function buildWorkoutStepForExercise({
  exercise,
  energy,
  restAfterSeconds,
}: {
  exercise: Exercise;
  energy: EnergyLevel;
  restAfterSeconds: number;
}): WorkoutStep {
  const durationSeconds = energy <= 2 ? 30 : 45;

  return {
    exercise_id: exercise.id,
    duration_seconds: durationSeconds,
    reps: exerciseUsesTimedMetric(exercise) ? null : energy <= 2 ? 6 : 10,
    rest_after_seconds: restAfterSeconds,
    adaptation_note: "Move at a pace that fits today. Skipping is always okay.",
  };
}

export function buildSingleExerciseWorkout(exercise: Exercise): Workout {
  const energy = exercise.intensity;
  const step = buildWorkoutStepForExercise({
    exercise,
    energy,
    restAfterSeconds: 0,
  });

  return {
    title: exercise.name,
    estimated_minutes: Math.max(1, Math.ceil(step.duration_seconds / 60)),
    energy_level: energy,
    steps: [step],
  };
}
