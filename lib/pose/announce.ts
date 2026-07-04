/**
 * Minimal Web Speech announcer for hands-free rep counting (T11).
 *
 * This is a deliberately small, self-contained helper so T11 stays mergeable
 * without pulling in the full T09 speech branch (`lib/speech.ts` + pre-rendered
 * audio, still unmerged). When T09 lands, route these calls through it and
 * delete this module — the call sites only use `announce()` / `stopAnnouncing()`.
 *
 * Counts use cancel-before-speak so a fast series ("one, two, three") never
 * piles up utterances on top of each other.
 */

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  return window.speechSynthesis;
}

/** True when the browser can speak — call sites keep a visual twin regardless. */
export function isSpeechAvailable(): boolean {
  return getSynth() !== null;
}

/**
 * Speak `text` immediately, cancelling any in-flight utterance first so rapid
 * rep counts don't overlap. No-op (silently) where speech is unavailable.
 */
export function announce(text: string): void {
  const synth = getSynth();
  if (!synth) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  synth.speak(utterance);
}

/** Stop any current/queued speech — used on pause, done, and unmount. */
export function stopAnnouncing(): void {
  getSynth()?.cancel();
}
