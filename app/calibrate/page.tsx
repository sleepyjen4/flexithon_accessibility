import { CalibrationFlow } from "@/components/CalibrationFlow";
import { getPoseExerciseById } from "@/lib/pose/exercises";
import type { ExerciseDef } from "@/types";

const SIDES: ExerciseDef["side"][] = ["left", "right", "either"];
const DEFAULT_CALIBRATION_EXERCISE: ExerciseDef["id"] = "seated_arm_raise";

/**
 * The standalone picker writes `?exercise=` only after Continue; the exercise
 * screen also includes `side=` so calibration captures the exact movement and
 * side the user is about to track (T13). Params are validated; anything
 * unexpected falls back to the standalone picker so a hand-typed URL never
 * breaks the flow.
 */
export default async function CalibratePage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; side?: string }>;
}) {
  const { exercise, side } = await searchParams;
  const requestedExercise = getPoseExerciseById(exercise as ExerciseDef["id"]);
  const exerciseId = requestedExercise?.id ?? DEFAULT_CALIBRATION_EXERCISE;
  const trackedSide = SIDES.find((value) => value === side);
  const startsFromExerciseQuery = Boolean(requestedExercise);

  return (
    <div className="flex flex-1 flex-col bg-cream px-5 py-8 sm:px-6 sm:py-10">
      <CalibrationFlow
        key={`${exerciseId}:${trackedSide ?? "either"}:${startsFromExerciseQuery ? "intro" : "pick"}`}
        exerciseId={exerciseId}
        startInIntro={startsFromExerciseQuery}
        side={trackedSide}
      />
    </div>
  );
}
