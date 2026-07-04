import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Abilities, AccessibilityPrefs, EnergyLevel } from "@/types";

export const DEFAULT_PREFS: AccessibilityPrefs = {
  text_size: "normal",
  high_contrast: false,
  reduced_motion: false,
  haptics: false,
  speech_enabled: true,
};

interface ProfileState {
  displayName: string | null;
  abilities: Abilities | null;
  prefs: AccessibilityPrefs;
  todaysEnergy: EnergyLevel | null;
  setProfile: (displayName: string | null, abilities: Abilities) => void;
  setPrefs: (prefs: AccessibilityPrefs) => void;
  setTodaysEnergy: (energy: EnergyLevel) => void;
}

/** Persisted locally so the demo path survives reloads; mirrored to the
 * Supabase `profiles` row (best-effort) when a user is signed in. */
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      displayName: null,
      abilities: null,
      prefs: DEFAULT_PREFS,
      todaysEnergy: null,
      setProfile: (displayName, abilities) => set({ displayName, abilities }),
      setPrefs: (prefs) => set({ prefs }),
      setTodaysEnergy: (energy) => set({ todaysEnergy: energy }),
    }),
    {
      name: "af-profile",
      // Backfills prefs saved before a new toggle existed (e.g. speech_enabled)
      // so upgrading never silently disables a feature for existing users.
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<ProfileState> | undefined;
        return {
          ...current,
          ...persistedState,
          prefs: { ...DEFAULT_PREFS, ...persistedState?.prefs },
        };
      },
    },
  ),
);
