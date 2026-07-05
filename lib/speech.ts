import type { SpeakOptions } from "@/types";
import { useProfileStore } from "@/store/profile";

interface SpeechRequest {
  text: string;
  resolve: () => void;
  settled: boolean;
}

let currentRequest: SpeechRequest | null = null;
const queuedRequests: SpeechRequest[] = [];
let pendingRepAnnouncement: ReturnType<typeof setTimeout> | null = null;

// A pre-generated instruction clip currently playing (Section 5c). Kept in this
// module so cancelSpeech()/mute/interrupt stop a clip the same way they stop
// Web Speech — one "stop everything" path for both.
let currentAudio: HTMLAudioElement | null = null;
let currentAudioResolve: (() => void) | null = null;

function stopCurrentAudio(): void {
  const audio = currentAudio;
  const resolve = currentAudioResolve;
  currentAudio = null;
  currentAudioResolve = null;

  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = "";
  }

  resolve?.();
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

// Ordered strongest-female-first; a name match wins over the generic
// "female" keyword, which wins over just taking the first English voice.
const FEMALE_VOICE_HINTS = [
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "serena",
  "zira",
  "hazel",
  "susan",
  "linda",
  "google uk english female",
  "female",
];

let preferredVoice: SpeechSynthesisVoice | null = null;
let voiceListenerAttached = false;

export function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  for (const hint of FEMALE_VOICE_HINTS) {
    const match = pool.find((voice) => voice.name.toLowerCase().includes(hint));
    if (match) return match;
  }

  // No named female voice on this platform — fall back to the first available
  // voice rather than none, so speech still works (voice stays platform default).
  return pool[0] ?? null;
}

/**
 * Picks a female English voice for workout speech. Voice lists load
 * asynchronously in most browsers, so this memoizes the choice and refreshes
 * it once `voiceschanged` fires.
 */
function getPreferredVoice(speechSynthesis: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0 && !preferredVoice) {
    preferredVoice = pickFemaleVoice(voices);
  }

  if (!voiceListenerAttached) {
    voiceListenerAttached = true;
    speechSynthesis.addEventListener?.("voiceschanged", () => {
      preferredVoice = pickFemaleVoice(speechSynthesis.getVoices());
    });
  }

  return preferredVoice;
}

let voicesReady: Promise<void> | null = null;

/**
 * Resolves once the browser's voice list is populated. Chrome/Edge return an
 * empty list on first call and populate it asynchronously (firing
 * `voiceschanged`), so the first — autoplayed — utterance must wait for it;
 * otherwise it speaks with the platform default voice instead of the chosen
 * female one, and only later utterances sound female. Cached after the first
 * resolve, so warmed-up calls add no latency.
 */
function ensureVoicesLoaded(speechSynthesis: SpeechSynthesis): Promise<void> {
  if (voicesReady) return voicesReady;

  voicesReady = new Promise<void>((resolve) => {
    if (speechSynthesis.getVoices().length > 0) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    speechSynthesis.addEventListener?.("voiceschanged", finish, { once: true });
    // Safety net for platforms that never fire `voiceschanged` or expose no
    // voices — never block speech forever; fall back to whatever is available.
    setTimeout(finish, 1000);
  });

  return voicesReady;
}

// Treat anything but an explicit `false` as enabled, so profiles persisted
// before this preference existed default to speech on rather than silently
// muted (Section 6, rule 8: TTS is opt-in, not opt-out by surprise).
function isSpeechEnabled(): boolean {
  return useProfileStore.getState().prefs.speech_enabled !== false;
}

// Muting should stop speech immediately, not wait for the next utterance
// boundary — mirrors the "state changes announce right away" spirit of rule 5.
useProfileStore.subscribe((state, prevState) => {
  if (prevState.prefs.speech_enabled !== false && state.prefs.speech_enabled === false) {
    cancelSpeech();
  }
});

// Start loading the voice list the moment this module runs on the client, so
// the first autoplayed utterance already has the female voice available rather
// than falling back to the platform default while voices load.
{
  const speechSynthesis = getSpeechSynthesis();
  if (speechSynthesis) {
    void ensureVoicesLoaded(speechSynthesis);
  }
}

// iOS/Safari block speech and audio until the user has interacted with the
// page, so an instruction autoplayed on a fresh load (e.g. the first workout
// exercise) is silently dropped. Priming speechSynthesis inside the first user
// gesture unlocks later programmatic speech for the rest of the session, so the
// Web Speech fallback below can be heard even when a clip's autoplay is blocked.
// Guarded for SSR and the test env, where window has no addEventListener.
if (
  typeof window !== "undefined" &&
  typeof window.addEventListener === "function"
) {
  const GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;
  const unlockSpeech = () => {
    for (const event of GESTURE_EVENTS) {
      window.removeEventListener(event, unlockSpeech);
    }
    const speechSynthesis = getSpeechSynthesis();
    if (!speechSynthesis) return;
    try {
      // A single-space (not empty) utterance at volume 0 primes speech silently
      // — some engines ignore empty text, which would leave speech locked on
      // Safari; the immediate cancel keeps it from queueing.
      const primer = new SpeechSynthesisUtterance(" ");
      primer.volume = 0;
      speechSynthesis.speak(primer);
      speechSynthesis.cancel();
    } catch {
      // Non-fatal: worst case autoplay stays gated on this browser.
    }
  };
  for (const event of GESTURE_EVENTS) {
    window.addEventListener(event, unlockSpeech, { passive: true });
  }
}

/**
 * Speak a user-triggered workout update. Longer utterances queue normally;
 * live rep counts use `announceRepCount` so they never lag behind the UI.
 * No-ops entirely while the user has speech turned off in settings.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmedText = text.trim();

  if (!trimmedText || !isSpeechEnabled()) {
    return Promise.resolve();
  }

  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis) {
    return Promise.resolve();
  }

  if (options.interrupt) {
    stopCurrentAudio();
    settleRequest(currentRequest);
    settleQueuedRequests();
    currentRequest = null;
    speechSynthesis.cancel();
  }

  return new Promise((resolve) => {
    const request: SpeechRequest = {
      text: trimmedText,
      resolve,
      settled: false,
    };

    queuedRequests.push(request);
    processSpeechQueue();
  });
}

/** Plays a pre-generated instruction clip (Section 5c), taking over from any
 * current speech or clip. Resolves when the clip ends, errors, or is stopped. */
function playClip(
  url: string,
  fallbackText: string,
  options: SpeakOptions,
): Promise<void> {
  // Take over from whatever is speaking or playing (interrupt semantics).
  cancelSpeech();

  return new Promise<void>((resolve) => {
    const audio = new window.Audio(url);
    currentAudio = audio;
    currentAudioResolve = resolve;

    const finish = () => {
      // Ignore late events from a clip that was already superseded/stopped.
      if (currentAudio !== audio) return;
      stopCurrentAudio();
    };

    // The clip couldn't start — autoplay blocked (Safari/iOS with no user
    // gesture yet) or the file is missing. Hand off to Web Speech so the
    // instruction is still heard instead of being silently dropped.
    const fallBackToSpeech = () => {
      if (currentAudio !== audio) return;
      audio.onended = null;
      audio.onerror = null;
      currentAudio = null;
      currentAudioResolve = null;
      resolve(speak(fallbackText, options));
    };

    audio.onended = finish;
    audio.onerror = fallBackToSpeech;
    void audio.play().catch(fallBackToSpeech);
  });
}

/**
 * Speak workout content, preferring a pre-generated audio clip when one exists
 * and falling back to the Web Speech API otherwise (Section 5c). No-ops while
 * the user has speech turned off. Clips always interrupt; `options` applies to
 * the Web Speech fallback path.
 */
export function speakOrPlay(
  audioUrl: string | null,
  fallbackText: string,
  options: SpeakOptions = {},
): Promise<void> {
  if (!isSpeechEnabled()) {
    return Promise.resolve();
  }

  if (audioUrl && typeof window !== "undefined" && typeof window.Audio !== "undefined") {
    return playClip(audioUrl, fallbackText, options);
  }

  return speak(fallbackText, options);
}

/**
 * Announce the latest rep count without letting speech fall behind the UI.
 * Fast reps coalesce into the newest count instead of queueing stale counts.
 */
export function announceRepCount(count: number): void {
  if (pendingRepAnnouncement) {
    clearTimeout(pendingRepAnnouncement);
  }

  pendingRepAnnouncement = setTimeout(() => {
    pendingRepAnnouncement = null;
    void speak(`Rep ${count}`, { interrupt: true });
  }, 160);
}

export function cancelSpeech(): void {
  if (pendingRepAnnouncement) {
    clearTimeout(pendingRepAnnouncement);
    pendingRepAnnouncement = null;
  }

  stopCurrentAudio();
  settleRequest(currentRequest);
  settleQueuedRequests();
  currentRequest = null;
  getSpeechSynthesis()?.cancel();
}

function processSpeechQueue(): void {
  if (currentRequest || queuedRequests.length === 0) {
    return;
  }

  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis) {
    settleQueuedRequests();
    return;
  }

  const request = queuedRequests.shift() ?? null;

  if (!request) {
    return;
  }

  // Claim the in-flight slot synchronously so a concurrent call can't also
  // dequeue; the actual utterance is deferred until voices are ready.
  currentRequest = request;
  void speakRequest(speechSynthesis, request);
}

async function speakRequest(
  speechSynthesis: SpeechSynthesis,
  request: SpeechRequest,
): Promise<void> {
  await ensureVoicesLoaded(speechSynthesis);

  // A cancel or interrupting utterance may have superseded this request while
  // we waited for voices — bail rather than speak stale text.
  if (currentRequest !== request || request.settled) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(request.text);
  const voice = getPreferredVoice(speechSynthesis);
  if (voice) {
    utterance.voice = voice;
  }
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onend = () => finishRequest(request);
  utterance.onerror = () => finishRequest(request);

  speechSynthesis.speak(utterance);
}

function finishRequest(request: SpeechRequest): void {
  if (currentRequest !== request) {
    settleRequest(request);
    return;
  }

  currentRequest = null;
  settleRequest(request);
  processSpeechQueue();
}

function settleRequest(request: SpeechRequest | null): void {
  if (!request || request.settled) {
    return;
  }

  request.settled = true;
  request.resolve();
}

function settleQueuedRequests(): void {
  while (queuedRequests.length > 0) {
    settleRequest(queuedRequests.shift() ?? null);
  }
}
