"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/Button";
import {
  createVoiceCommandMatcher,
  createVoiceRecognition,
  isVoiceControlSupported,
  VOICE_COMMAND_PHRASES,
  type VoiceCommandMatcher,
  type VoiceRecognition,
} from "@/lib/voice";
import { getActiveSpeechText } from "@/lib/speech";
import type { VoiceCommand } from "@/types";

interface VoiceControlProps {
  /** Commands this screen responds to; recognized phrases outside the list are ignored. */
  commands: readonly VoiceCommand[];
  onCommand: (command: VoiceCommand) => void;
}

type MicState = "off" | "listening" | "unavailable";

/** What the last recognition result gave us, for visible feedback: a command,
 * or speech that contained no command word (so the user can adjust phrasing). */
type Heard = { command: VoiceCommand } | { unmatched: string };

function lastWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/);
  const tail = words.slice(-count).join(" ");
  return words.length > count ? `…${tail}` : tail;
}

/** T17/W1: optional hands-free control over a small spoken grammar. Renders
 * nothing where the browser has no SpeechRecognition — every action stays
 * available by touch and keyboard, voice is only ever a layer on top. */
export function VoiceControl({ commands, onCommand }: VoiceControlProps) {
  const [micState, setMicState] = useState<MicState>("off");
  const [heard, setHeard] = useState<Heard | null>(null);

  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const matcherRef = useRef<VoiceCommandMatcher | null>(null);
  // Whether listening SHOULD continue: Chrome ends continuous recognition
  // after silence, so onend restarts it while this stays true.
  const wantListeningRef = useRef(false);

  // The recognizer is long-lived; route callbacks through refs so it always
  // sees the latest handlers (same pattern as PoseTracker's provider wiring).
  const commandsRef = useRef(commands);
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    commandsRef.current = commands;
    onCommandRef.current = onCommand;
  }, [commands, onCommand]);

  // SpeechRecognition exists only client-side; the server snapshot says
  // "unsupported" so SSR markup and the first client render agree (same
  // hydration pattern as SpeechToggle), then the real detection kicks in.
  const supported = useSyncExternalStore(
    () => () => {},
    isVoiceControlSupported,
    () => false,
  );

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    matcherRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    const recognition = createVoiceRecognition();
    if (!recognition) return;

    wantListeningRef.current = true;
    recognitionRef.current = recognition;
    // Dispatch policy (interim/final dedupe, cooldown, narration echo guard)
    // lives in lib/voice.ts where it is unit-tested; this component only
    // feeds results in and renders what came out.
    const matcher = createVoiceCommandMatcher({
      getSpokenText: getActiveSpeechText,
    });
    matcherRef.current = matcher;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;

        const alternatives: string[] = [];
        for (let alt = 0; alt < result.length; alt += 1) {
          const transcript = result[alt]?.transcript;
          if (transcript) alternatives.push(transcript);
        }

        const command = matcher.match(i, alternatives, commandsRef.current);
        if (command) {
          setHeard({ command });
          onCommandRef.current(command);
        } else if (result.isFinal && !matcher.isConsumed(i)) {
          // Speech that settled without a command word: show what was heard
          // so the user can adjust phrasing (invaluable when rehearsing).
          const transcript = alternatives[0]?.trim();
          if (transcript) setHeard({ unmatched: lastWords(transcript, 6) });
        }
      }
    };

    recognition.onerror = (event) => {
      // Mic permission declined or the speech service is blocked: stop cleanly
      // and point back to the always-available controls. Transient errors
      // ("no-speech", "aborted", "network") fall through to onend's restart.
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        stopListening();
        setMicState("unavailable");
      }
    };

    recognition.onend = () => {
      if (!wantListeningRef.current) return;
      // A new session numbers its results from zero again.
      matcher.reset();
      recognition.start();
    };

    try {
      recognition.start();
      setMicState("listening");
    } catch {
      stopListening();
      setMicState("unavailable");
    }
  }, [stopListening]);

  const toggleListening = () => {
    setHeard(null);
    if (micState === "listening") {
      stopListening();
      setMicState("off");
    } else {
      startListening();
    }
  };

  // Release the mic when the screen unmounts (e.g. finishing routes away).
  useEffect(() => stopListening, [stopListening]);

  if (!supported) return null;

  const listening = micState === "listening";
  const phraseList = commands
    .map((command) => `“${VOICE_COMMAND_PHRASES[command][0]}”`)
    .join(", ");

  return (
    <section
      aria-labelledby="voice-control-title"
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <div className="space-y-2">
        <h2
          id="voice-control-title"
          className="text-xl font-bold text-slate-900"
        >
          Optional voice control
        </h2>
        <p className="text-base text-slate-600">
          Control this screen hands-free by saying {phraseList}. The microphone
          listens only while this is on, and every control also works by touch
          and keyboard.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mt-4 gap-2"
        onClick={toggleListening}
        aria-pressed={listening}
      >
        {listening ? (
          <MicOff aria-hidden="true" className="h-6 w-6" />
        ) : (
          <Mic aria-hidden="true" className="h-6 w-6" />
        )}
        {listening ? "Turn voice control off" : "Turn voice control on"}
      </Button>

      <p className="mt-3 text-base text-slate-600" aria-live="polite">
        {micState === "listening"
          ? "Voice control is on and listening for commands."
          : micState === "unavailable"
            ? "The microphone couldn't start, so voice control is off for now. Everything here still works by touch and keyboard."
            : "Voice control is off."}
      </p>

      {listening && heard ? (
        "command" in heard ? (
          <p className="mt-1 text-base font-semibold text-slate-900">
            {/* The primary phrase, not the command id — "add time", never
                the internal "extend". */}
            Heard “{VOICE_COMMAND_PHRASES[heard.command][0]}”.
          </p>
        ) : (
          <p className="mt-1 text-base text-slate-600">
            Heard “{heard.unmatched}” — listening for a command word.
          </p>
        )
      ) : null}
    </section>
  );
}
