import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersonalRange } from "@/types";

interface CalibrationState {
  ranges: Record<string, PersonalRange>;
  setRange: (exerciseId: string, range: PersonalRange) => void;
  clearRange: (exerciseId: string) => void;
}

/**
 * Personal range-of-motion calibration for F9 (Section 5b), keyed by
 * exercise id and persisted so a person only calibrates once. Recalibrating
 * is always one tap away from the exercise screen.
 */
export const useCalibrationStore = create<CalibrationState>()(
  persist(
    (set) => ({
      ranges: {},
      setRange: (exerciseId, range) =>
        set((state) => ({ ranges: { ...state.ranges, [exerciseId]: range } })),
      clearRange: (exerciseId) =>
        set((state) => {
          const rest = { ...state.ranges };
          delete rest[exerciseId];
          return { ranges: rest };
        }),
    }),
    { name: "af-calibration" },
  ),
);
