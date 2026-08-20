import type { AccessibilityPrefs } from "@/types";
import { useProfileStore } from "@/store/profile";

/** Turns spoken instructions on/off from code (the "mute"/"unmute" voice
 * commands) — same store update as the SpeechToggle button, so the corner
 * toggle's icon follows along. */
export function setSpeechEnabled(enabled: boolean): void {
  const { prefs, setPrefs } = useProfileStore.getState();
  if (prefs.speech_enabled !== false === enabled) return;
  setPrefs({ ...prefs, speech_enabled: enabled });
}

/** Applies prefs to the document root so CSS can respond app-wide. */
export function applyPrefsToDocument(prefs: AccessibilityPrefs): void {
  const root = document.documentElement;
  root.dataset.textSize = prefs.text_size;
  root.dataset.contrast = prefs.high_contrast ? "high" : "normal";
  root.dataset.reducedMotion = prefs.reduced_motion ? "true" : "false";
}
