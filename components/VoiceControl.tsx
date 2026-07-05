"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/Button";
import {
  createVoiceRecognition,
  isCommandInText,
  isVoiceControlSupported,
  parseVoiceCommand,
  VOICE_COMMAND_PHRASES,
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

/** T17/W1: optional hands-free control over a small spoken grammar. Renders
 * nothing where the browser has no SpeechRecognition — every action stays
 * available by touch and keyboard, voice is only ever a layer on top. */
export function VoiceControl({ commands, onCommand }: VoiceControlProps) {
  const [micState, setMicState] = useState<MicState>("off");
  const [lastHeard, setLastHeard] = useState<VoiceCommand | null>(null);

  const recognitionRef = useRef<VoiceRecognition | null>(null);
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

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const command = parseVoiceCommand(result[0].transcript);
        if (!command || !commandsRef.current.includes(command)) continue;
        // Echo guard: if the app's own narration (which the mic hears through
        // the speakers) contains this command word — e.g. the rest cue says
        // "the next exercise waits for you" — treat it as an echo, not the
        // user. Commands not present in the narration still work mid-speech.
        const spokenText = getActiveSpeechText();
        if (spokenText && isCommandInText(command, spokenText)) continue;
        setLastHeard(command);
        onCommandRef.current(command);
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
      if (wantListeningRef.current) recognition.start();
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
    setLastHeard(null);
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

      {listening && lastHeard ? (
        <p className="mt-1 text-base font-semibold text-slate-900">
          Heard “{lastHeard}”.
        </p>
      ) : null}
    </section>
  );
}
