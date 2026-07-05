import type { ReactNode } from "react";
import { SpeechToggle } from "@/components/SpeechToggle";

interface WorkoutPageFrameProps {
  children: ReactNode;
}

export function WorkoutPageFrame({ children }: WorkoutPageFrameProps) {
  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-md justify-end">
        <SpeechToggle />
      </div>
      {children}
    </div>
  );
}
