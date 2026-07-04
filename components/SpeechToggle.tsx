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
    () => () => { },
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
      onClick={toggleSpeech}
      aria-pressed={showEnabled}
      aria-label={
        showEnabled ? "Turn spoken instructions off" : "Turn spoken instructions on"
      }
      className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      {showEnabled ? (
        <Volume2 aria-hidden="true" className="h-6 w-6" />
      ) : (
        <VolumeX aria-hidden="true" className="h-6 w-6" />
      )}
    </button>
  );
}
