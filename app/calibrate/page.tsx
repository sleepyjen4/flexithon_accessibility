import { CalibrationFlow } from "@/components/CalibrationFlow";
import { SpeechToggle } from "@/components/SpeechToggle";
import { getPoseExerciseById } from "@/lib/pose/exercises";
import type { ExerciseDef } from "@/types";

const SIDES: ExerciseDef["side"][] = ["left", "right", "either"];
const DEFAULT_CALIBRATION_EXERCISE: ExerciseDef["id"] = "seated_arm_raise";

/**
 * The exercise screen links here with `?exercise=&side=` so calibration
 * captures the range for exactly the movement and side the user is about to
 * track (T13). Both params are validated; anything unexpected falls back to the
 * arm-raise hero on either side, so a hand-typed URL never breaks the flow.
 */
export default async function CalibratePage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; side?: string }>;
}) {
  const { exercise, side } = await searchParams;
  const exerciseId =
    getPoseExerciseById(exercise as ExerciseDef["id"])?.id ??
    DEFAULT_CALIBRATION_EXERCISE;
  const trackedSide = SIDES.find((value) => value === side);

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl justify-end">
        <SpeechToggle />
      </div>
      <CalibrationFlow
        exerciseId={exerciseId}
        startInIntro
        side={trackedSide}
      />
    </div>
  );
}
