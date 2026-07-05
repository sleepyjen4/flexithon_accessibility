import type { VoiceCommand } from "@/types";

/**
 * T17/W1 — hands-free voice control on the Web Speech API's SpeechRecognition.
 * Chrome-family only: callers must feature-detect via isVoiceControlSupported
 * and treat voice as an optional layer over touch/keyboard controls, never a
 * requirement (AGENTS.md Section 5b spirit: graceful degradation always).
 */

// TypeScript's lib.dom has no SpeechRecognition declarations (the API is
// prefixed and Chrome-only), so we declare exactly the surface we use.
export interface VoiceRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface VoiceRecognitionErrorEvent {
  error: string;
}

export interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

function getRecognitionConstructor(): VoiceRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

export function isVoiceControlSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

/** Builds a recognizer configured for command listening (continuous, final
 * results only). Returns null where the browser has no SpeechRecognition. */
export function createVoiceRecognition(): VoiceRecognition | null {
  const RecognitionConstructor = getRecognitionConstructor();
  if (!RecognitionConstructor) return null;

  const recognition = new RecognitionConstructor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  return recognition;
}

/**
 * Spoken synonyms per command — the whole grammar. Matching is exact whole
 * words only, so the app's own spoken cues picked up through the mic
 * ("Paused.", "Tracking resumed.", "Rep 5") can never echo-trigger a command.
 * Keep every synonym out of the on-screen/spoken cue copy when adding one.
 */
export const VOICE_COMMAND_PHRASES: Readonly<
  Record<VoiceCommand, readonly string[]>
> = {
  start: ["start", "begin"],
  pause: ["pause"],
  resume: ["resume", "continue"],
  next: ["next", "done"],
  skip: ["skip"],
  finish: ["finish"],
};

const COMMAND_BY_WORD: ReadonlyMap<string, VoiceCommand> = new Map(
  (
    Object.entries(VOICE_COMMAND_PHRASES) as [
      VoiceCommand,
      readonly string[],
    ][]
  ).flatMap(([command, phrases]) =>
    phrases.map((phrase) => [phrase, command] as const),
  ),
);

/**
 * Extracts a command from a recognized utterance, or null when it contains
 * none. Scans words from the end so the most recent instruction wins when
 * someone corrects themselves ("pause — no wait, resume").
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const words = transcript.toLowerCase().split(/[^a-z]+/).filter(Boolean);

  for (let index = words.length - 1; index >= 0; index -= 1) {
    const word = words[index];
    if (!word) continue;
    const command = COMMAND_BY_WORD.get(word);
    if (command) return command;
  }

  return null;
}

/**
 * Whether any of a command's spoken phrases appears (as a whole word) in the
 * given text. VoiceControl uses this as its echo guard: a command heard while
 * the app is speaking text that contains that same word is almost certainly
 * the narration coming back through the mic — e.g. the rest cue "the next
 * exercise waits for you" must not voice-skip the rest — so it is dropped.
 * Commands whose words are NOT in the narration still work mid-speech.
 */
export function isCommandInText(command: VoiceCommand, text: string): boolean {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/));
  return VOICE_COMMAND_PHRASES[command].some((phrase) => words.has(phrase));
}
