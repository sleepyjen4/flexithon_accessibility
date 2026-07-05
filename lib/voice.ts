import type { VoiceCommand } from "@/types";

/**
 * T17/W1 — hands-free voice control on the Web Speech API's SpeechRecognition.
 * Chrome-family only: callers must feature-detect via isVoiceControlSupported
 * and treat voice as an optional layer over touch/keyboard controls, never a
 * requirement (AGENTS.md Section 5b spirit: graceful degradation always).
 */

// TypeScript's lib.dom has no SpeechRecognition declarations (the API is
// prefixed and Chrome-only), so we declare exactly the surface we use.
interface VoiceRecognitionResult extends ArrayLike<{ transcript: string }> {
  isFinal: boolean;
}

export interface VoiceRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<VoiceRecognitionResult>;
}

export interface VoiceRecognitionErrorEvent {
  error: string;
}

export interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
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

/**
 * Builds a recognizer tuned for command listening: continuous, WITH interim
 * results (a one-word command can be acted on ~a second before the final
 * result lands — the matcher dedupes when the final arrives), and several
 * alternatives per result so a mistranscribed top guess ("text") doesn't hide
 * a correct second guess ("next"). Returns null without SpeechRecognition.
 */
export function createVoiceRecognition(): VoiceRecognition | null {
  const RecognitionConstructor = getRecognitionConstructor();
  if (!RecognitionConstructor) return null;

  const recognition = new RecognitionConstructor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  recognition.lang = "en-US";
  return recognition;
}

/**
 * Spoken synonyms per command — the displayed grammar. Matching is exact
 * whole words only, so the app's own spoken cues picked up through the mic
 * ("Paused.", "Tracking resumed.", "Rep 5") can never echo-trigger a command.
 * RULE for adding a word here or to the sound-alikes below: it must not
 * appear in any cue text the app itself speaks or announces — check first,
 * then rely on the echo guard only for uncontrolled text (AI notes).
 */
export const VOICE_COMMAND_PHRASES: Readonly<
  Record<VoiceCommand, readonly string[]>
> = {
  start: ["start", "begin"],
  pause: ["pause", "stop"],
  resume: ["resume", "continue"],
  next: ["next", "done"],
  skip: ["skip"],
  finish: ["finish", "finished"],
  extend: ["add time", "more time", "extend"],
  // Several spoken instructions contain the word "repeat" ("Release slowly
  // and repeat.") — the echo guard covers them, and it's also what stops a
  // replayed narration from re-triggering this command in a loop.
  repeat: ["repeat", "again"],
  mute: ["mute"],
  unmute: ["unmute"],
};

/**
 * Curated mistranscriptions the recognizer produces for the grammar words
 * (observed Chrome behavior for short, isolated words). Matched exactly like
 * phrases but never displayed. Same rule as above: keep these out of any
 * copy the app speaks.
 */
const VOICE_COMMAND_SOUND_ALIKES: Readonly<
  Record<VoiceCommand, readonly string[]>
> = {
  start: ["star"],
  pause: ["paws"],
  resume: ["presume"],
  next: ["text", "necks", "nest", "dawn"],
  skip: ["ship"],
  finish: ["finnish"],
  extend: [],
  repeat: [],
  mute: ["moot"],
  // "unmute" often comes back as two words; the longer phrase wins the tie
  // against plain "mute" so it can't invert the user's intent.
  unmute: ["un mute", "on mute", "unmuted"],
};

/** Every phrase that can match a command (its displayed phrases plus its
 * sound-alikes), pre-split into words — phrases may be multi-word. */
interface MatchablePhrase {
  command: VoiceCommand;
  words: readonly string[];
}

const MATCHABLE_PHRASES: readonly MatchablePhrase[] = (
  Object.keys(VOICE_COMMAND_PHRASES) as VoiceCommand[]
).flatMap((command) =>
  [
    ...VOICE_COMMAND_PHRASES[command],
    ...VOICE_COMMAND_SOUND_ALIKES[command],
  ].map((phrase) => ({ command, words: phrase.split(" ") })),
);

function normalizeWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Last position (index of the phrase's final word) where the phrase appears
 * as a whole-word sequence in `words`, or -1 when it never does. */
function lastPhraseEnd(
  words: readonly string[],
  phrase: readonly string[],
): number {
  outer: for (let start = words.length - phrase.length; start >= 0; start -= 1) {
    for (let offset = 0; offset < phrase.length; offset += 1) {
      if (words[start + offset] !== phrase[offset]) continue outer;
    }
    return start + phrase.length - 1;
  }
  return -1;
}

/**
 * Extracts a command from a recognized utterance, or null when it contains
 * none. The match ending latest in the utterance wins, so the most recent
 * instruction survives a self-correction ("pause — no wait, resume"); on a
 * tie the longer phrase wins, so "un mute" is never read as "mute".
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const words = normalizeWords(transcript);

  let best: VoiceCommand | null = null;
  let bestEnd = -1;
  let bestLength = 0;

  for (const { command, words: phraseWords } of MATCHABLE_PHRASES) {
    const end = lastPhraseEnd(words, phraseWords);
    if (
      end > bestEnd ||
      (end === bestEnd && end >= 0 && phraseWords.length > bestLength)
    ) {
      best = command;
      bestEnd = end;
      bestLength = phraseWords.length;
    }
  }

  return best;
}

/**
 * Whether any phrase that can match this command (displayed phrases AND
 * sound-alikes) appears as a whole-word sequence in the given text. The echo
 * guard: a command heard while the app is speaking text containing that same
 * phrase is almost certainly the narration coming back through the mic —
 * e.g. the rest cue "the next exercise waits for you" must not voice-skip
 * the rest — so it is dropped. Commands whose phrases are NOT in the
 * narration work mid-speech.
 */
export function isCommandInText(command: VoiceCommand, text: string): boolean {
  const words = normalizeWords(text);
  return MATCHABLE_PHRASES.some(
    (phrase) =>
      phrase.command === command && lastPhraseEnd(words, phrase.words) !== -1,
  );
}

// A command repeated within this window is treated as the same utterance —
// interim/final pairs land on one result index (deduped there), but a session
// restart resets indexes, so the cooldown catches duplicates across it too.
export const COMMAND_COOLDOWN_MS = 1000;

interface VoiceMatcherOptions {
  cooldownMs?: number;
  /** The app's own currently spoken text (echo guard); defaults to none. */
  getSpokenText?: () => string | null;
  /** Injectable clock for tests. */
  now?: () => number;
}

export interface VoiceCommandMatcher {
  /**
   * Feed one recognition result (all its alternative transcripts, best
   * first); returns a command to dispatch, or null. Call for interim AND
   * final results — each result index dispatches at most once.
   */
  match(
    resultIndex: number,
    alternatives: readonly string[],
    allowed: readonly VoiceCommand[],
  ): VoiceCommand | null;
  /** Whether this result index already carried a command (dispatched or
   * suppressed) — lets the UI avoid showing it as "unmatched". */
  isConsumed(resultIndex: number): boolean;
  /** Call when a recognition session ends: result indexes start over. */
  reset(): void;
}

/**
 * The dispatch policy for a listening session, kept out of React so it is
 * unit-testable: interim/final dedupe per result index, a per-command
 * cooldown, and the narration echo guard.
 */
export function createVoiceCommandMatcher(
  options: VoiceMatcherOptions = {},
): VoiceCommandMatcher {
  const cooldownMs = options.cooldownMs ?? COMMAND_COOLDOWN_MS;
  const getSpokenText = options.getSpokenText ?? (() => null);
  const now = options.now ?? Date.now;

  const consumedIndexes = new Set<number>();
  // Survives reset() on purpose: session restarts must not defeat the cooldown.
  const lastDispatchedAt = new Map<VoiceCommand, number>();

  return {
    match(resultIndex, alternatives, allowed) {
      if (consumedIndexes.has(resultIndex)) return null;

      let command: VoiceCommand | null = null;
      for (const alternative of alternatives) {
        const parsed = parseVoiceCommand(alternative);
        if (parsed && allowed.includes(parsed)) {
          command = parsed;
          break;
        }
      }
      if (!command) return null;

      // The index carried a command — consume it now so a suppressed interim
      // can't fire again when its final result arrives after narration ends.
      consumedIndexes.add(resultIndex);

      const spokenText = getSpokenText();
      if (spokenText && isCommandInText(command, spokenText)) return null;

      const lastAt = lastDispatchedAt.get(command);
      if (lastAt !== undefined && now() - lastAt < cooldownMs) return null;

      lastDispatchedAt.set(command, now());
      return command;
    },
    isConsumed(resultIndex) {
      return consumedIndexes.has(resultIndex);
    },
    reset() {
      consumedIndexes.clear();
    },
  };
}
