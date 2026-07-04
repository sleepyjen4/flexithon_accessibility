import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersonalRange } from "@/types";

interface CalibrationState {
  /** Personal range of motion per exercise id (T08, F9). */
  ranges: Record<string, PersonalRange>;
  setRange: (exerciseId: string, range: PersonalRange) => void;
  clearRange: (exerciseId: string) => void;
}

/** Persisted locally so a calibration survives reloads and the whole demo
 * path works without a Supabase login (mirrors profile/history stores). */
export const useCalibrationStore = create<CalibrationState>()(
  persist(
    (set) => ({
      ranges: {},
      setRange: (exerciseId, range) =>
        set((state) => ({ ranges: { ...state.ranges, [exerciseId]: range } })),
      clearRange: (exerciseId) =>
        set((state) => {
          const next = { ...state.ranges };
          delete next[exerciseId];
          return { ranges: next };
        }),
    }),
    { name: "af-calibration" },
  ),
);
