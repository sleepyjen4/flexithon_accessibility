import { WorkoutPageFrame } from "@/components/WorkoutPageFrame";
import { DailyWorkoutLoader } from "@/components/DailyWorkoutLoader";

export default function WorkoutPage() {
  return (
    <WorkoutPageFrame>
      <DailyWorkoutLoader />
    </WorkoutPageFrame>
  );
}
