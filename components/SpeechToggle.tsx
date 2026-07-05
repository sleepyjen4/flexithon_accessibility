"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useProfileStore } from "@/store/profile";
import { savePrefsToSupabase } from "@/lib/prefs";

/** Corner toggle for spoken instructions & cues. Lives at the page level so it
 * stays visible across every /workout state (exercise, rest, finish). */
export function SpeechToggle() {
  const prefs = useProfileStore((state) => state.prefs);
  const setPrefs = useProfileStore((state) => state.setPrefs);

  // The pref is persisted client-side; render the default-on icon until hydrated
  // so SSR and the first client render agree (no hydration mismatch).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const speechEnabled = prefs.speech_enabled !== false;
  const showEnabled = hydrated ? speechEnabled : true;

  const toggleSpeech = () => {
    const next = { ...prefs, speech_enabled: !speechEnabled };
    setPrefs(next);
    void savePrefsToSupabase(next);
  };

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={toggleSpeech}
      aria-pressed={showEnabled}
      aria-label={
        showEnabled
          ? "Turn spoken instructions off"
          : "Turn spoken instructions on"
      }
      className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink transition-colors hover:bg-mint"
    >
      {showEnabled ? (
        <Volume2 aria-hidden="true" className="h-6 w-6" />
      ) : (
        <VolumeX aria-hidden="true" className="h-6 w-6" />
      )}
    </button>
  );
}
