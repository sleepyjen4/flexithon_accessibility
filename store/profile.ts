import { create } from "zustand";
import type { Abilities, AccessibilityPrefs, EnergyLevel } from "@/types";

interface ProfileState {
  displayName: string | null;
  abilities: Abilities | null;
  prefs: AccessibilityPrefs | null;
  todaysEnergy: EnergyLevel | null;
  setProfile: (displayName: string, abilities: Abilities) => void;
  setPrefs: (prefs: AccessibilityPrefs) => void;
  setTodaysEnergy: (energy: EnergyLevel) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  displayName: null,
  abilities: null,
  prefs: null,
  todaysEnergy: null,
  setProfile: (displayName, abilities) => set({ displayName, abilities }),
  setPrefs: (prefs) => set({ prefs }),
  setTodaysEnergy: (energy) => set({ todaysEnergy: energy }),
}));
