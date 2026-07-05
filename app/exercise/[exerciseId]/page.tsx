import { notFound } from "next/navigation";
import { WorkoutPageFrame } from "@/components/WorkoutPageFrame";
import { WorkoutSessionLoader } from "@/components/WorkoutSessionLoader";
import { EXERCISES, getExerciseById } from "@/lib/exercises";
import { buildSingleExerciseWorkout } from "@/lib/workouts";

interface ExerciseWorkoutPageProps {
  params: Promise<{
    exerciseId: string;
  }>;
}

export function generateStaticParams() {
  return EXERCISES.map((exercise) => ({
    exerciseId: exercise.id,
  }));
}

export default async function ExerciseWorkoutPage({
  params,
}: ExerciseWorkoutPageProps) {
  const { exerciseId } = await params;
  const exercise = getExerciseById(exerciseId);

  if (!exercise) notFound();

  return (
    <WorkoutPageFrame>
      <WorkoutSessionLoader
        key={exercise.id}
        workout={buildSingleExerciseWorkout(exercise)}
      />
    </WorkoutPageFrame>
  );
}
