import { create } from "zustand";
import type { Workout } from "@/types";

interface SessionState {
  workout: Workout | null;
  currentStepIndex: number;
  completedSteps: number[];
  peakRomDegrees: Record<string, number>;
  setWorkout: (workout: Workout) => void;
  completeStep: (index: number) => void;
  advanceStep: () => void;
  recordRom: (exerciseId: string, degrees: number) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  workout: null,
  currentStepIndex: 0,
  completedSteps: [],
  peakRomDegrees: {},
  setWorkout: (workout) =>
    set({ workout, currentStepIndex: 0, completedSteps: [], peakRomDegrees: {} }),
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
  reset: () =>
    set({ workout: null, currentStepIndex: 0, completedSteps: [], peakRomDegrees: {} }),
}));
