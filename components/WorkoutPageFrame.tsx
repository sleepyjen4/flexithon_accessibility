import type { ReactNode } from "react";

interface WorkoutPageFrameProps {
  children: ReactNode;
}

export function WorkoutPageFrame({ children }: WorkoutPageFrameProps) {
  // The speech + voice controls now live in the player's own stable header
  // (WorkoutPlayer), so the mic sits next to the mute button and never drops
  // between the exercise and rest steps.
  return (
    <div className="flex flex-1 flex-col bg-cream px-5 py-8 sm:px-6 sm:py-10">
      {children}
    </div>
  );
}
