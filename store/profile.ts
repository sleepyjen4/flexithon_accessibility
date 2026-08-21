import { useSyncExternalStore } from "react";
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
  setDisplayName: (displayName: string | null) => void;
  setAbilities: (abilities: Abilities) => void;
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
      setDisplayName: (displayName) => set({ displayName }),
      setAbilities: (abilities) => set({ abilities }),
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

// `persist` rehydrates from localStorage after the server has already rendered,
// so `abilities` is null in the SSR pass and may be populated by the time the
// browser renders. Branching on it directly is a hydration mismatch — the class
// of bug that pinned the energy dial to 3, and one this repo cannot unit-test
// (AGENTS.md Section 2: no DOM test environment).
const subscribeToHydration = (onStoreChange: () => void) =>
  useProfileStore.persist.onFinishHydration(onStoreChange);
const getHydrated = () => useProfileStore.persist.hasHydrated();
const getHydratedOnServer = () => false;

/**
 * Whether a saved ability profile exists, in a form that is safe to branch on
 * during render.
 *
 * React uses the server snapshot for the hydration pass too, so both renders
 * agree on "no profile" and the answer settles on the re-render immediately
 * after. Callers get false first and the truth a tick later; anything gated on
 * this should treat false as "not known yet", not as "definitely a new user".
 */
export function useHasAbilityProfile(): boolean {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydrated,
    getHydratedOnServer,
  );
  const abilities = useProfileStore((state) => state.abilities);

  return hydrated && abilities !== null;
}
