import { SpeechToggle } from "@/components/SpeechToggle";
import { WorkoutPlayer } from "@/components/WorkoutPlayer";

export default function WorkoutPage() {
  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-10">
      {/* Page-level so the speech toggle stays visible across every state
          (exercise, rest, finish), aligned to the content column. */}
      <div className="mx-auto flex w-full max-w-md justify-end">
        <SpeechToggle />
      </div>
      <WorkoutPlayer />
    </div>
  );
}
