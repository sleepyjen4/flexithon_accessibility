import { create } from "zustand";
import type { WorkoutSessionSummary, Workout } from "@/types";

interface SessionState {
  workout: Workout | null;
  currentStepIndex: number;
  completedSteps: number[];
  peakRomDegrees: Record<string, number>;
  /** Set once the current workout has been saved to history/Supabase, so a
   * remounted WorkoutFinish (e.g. after browser back/forward) shows the
   * saved confirmation instead of re-offering the save action. */
  savedSummary: WorkoutSessionSummary | null;
  setWorkout: (workout: Workout) => void;
  completeStep: (index: number) => void;
  advanceStep: () => void;
  recordRom: (exerciseId: string, degrees: number) => void;
  markSaved: (summary: WorkoutSessionSummary) => void;
  reset: () => void;
}

const FRESH_WORKOUT_STATE = {
  currentStepIndex: 0,
  completedSteps: [],
  peakRomDegrees: {},
  savedSummary: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  workout: null,
  ...FRESH_WORKOUT_STATE,
  setWorkout: (workout) => set({ workout, ...FRESH_WORKOUT_STATE }),
  completeStep: (index) =>
    set((state) => ({
      completedSteps: state.completedSteps.includes(index)
        ? state.completedSteps
        : [...state.completedSteps, index],
    })),
  advanceStep: () =>
    set((state) => ({ currentStepIndex: state.currentStepIndex + 1 })),
  recordRom: (exerciseId, degrees) =>
    set((state) => ({
      peakRomDegrees: {
        ...state.peakRomDegrees,
        [exerciseId]: Math.max(state.peakRomDegrees[exerciseId] ?? 0, degrees),
      },
    })),
  markSaved: (summary) => set({ savedSummary: summary }),
  reset: () => set({ workout: null, ...FRESH_WORKOUT_STATE }),
}));
