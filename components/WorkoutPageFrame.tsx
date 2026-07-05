import type { ReactNode } from "react";
import { SpeechToggle } from "@/components/SpeechToggle";

interface WorkoutPageFrameProps {
  children: ReactNode;
}

export function WorkoutPageFrame({ children }: WorkoutPageFrameProps) {
  return (
    <div className="flex flex-1 flex-col bg-cream px-5 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto mb-3 flex w-full max-w-md justify-end lg:max-w-4xl">
        <SpeechToggle />
      </div>
      {children}
    </div>
  );
}
