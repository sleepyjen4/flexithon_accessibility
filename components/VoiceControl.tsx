"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, X } from "lucide-react";
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

// Short, scannable gloss per command for the quick-start popover. Kept generic
// so it reads the same on every screen; each screen decides the exact effect.
const COMMAND_HINTS: Record<VoiceCommand, string> = {
  start: "Get started",
  pause: "Pause",
  resume: "Resume",
  next: "Next move",
  skip: "Skip this one",
  finish: "Finish up",
  extend: "Add 30 seconds",
  repeat: "Hear it again",
  mute: "Silence the voice",
  unmute: "Turn the voice on",
};

function lastWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/);
  const tail = words.slice(-count).join(" ");
  return words.length > count ? `…${tail}` : tail;
}

/** T17/W1: optional hands-free control over a small spoken grammar. Renders a
 * compact mic toggle that sits next to the mute button; turning it on opens a
 * dismissible quick-start popover of the commands for this screen. Renders
 * nothing where the browser has no SpeechRecognition — every action stays
 * available by touch and keyboard, voice is only ever a layer on top. */
export function VoiceControl({ commands, onCommand }: VoiceControlProps) {
  const [micState, setMicState] = useState<MicState>("off");
  const [heard, setHeard] = useState<Heard | null>(null);
  // The command guide opens when voice turns on; the user can dismiss it
  // (outside click / Escape / close button) without turning voice off.
  const [panelOpen, setPanelOpen] = useState(false);
  // The popover is portaled to <body> (see below) so it always paints above
  // page content, including ancestors with a `rise-in` fade/slide animation
  // — those establish their own stacking context on transform/opacity, which
  // would otherwise trap a same-tree z-index popover behind later siblings.
  // Its position is computed from the trigger button's own coordinates.
  const [panelPos, setPanelPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const panelId = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
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
      setPanelOpen(false);
    } else {
      startListening();
      // Show the quick-start guide the moment voice turns on.
      setPanelOpen(true);
    }
  };

  // Release the mic when the screen unmounts (e.g. finishing routes away).
  useEffect(() => stopListening, [stopListening]);

  // Dismiss the popover on outside pointer / Escape without stopping the mic.
  // The panel is portaled out of this subtree (see below), so containment
  // must be checked against both the trigger and the portaled panel.
  useEffect(() => {
    if (!panelOpen) return;
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setPanelOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [panelOpen]);

  const listening = micState === "listening";
  const showPanel = panelOpen && (listening || micState === "unavailable");

  // Anchor the portaled panel to the trigger button's own coordinates rather
  // than relying on CSS `absolute` positioning, so it renders correctly no
  // matter which stacking context it's portaled out of.
  useLayoutEffect(() => {
    if (!showPanel) return;
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showPanel]);

  if (!supported) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        suppressHydrationWarning
        onClick={toggleListening}
        aria-pressed={listening}
        aria-expanded={showPanel}
        aria-controls={showPanel ? panelId : undefined}
        aria-label={
          listening ? "Turn voice control off" : "Turn voice control on"
        }
        className={`inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          listening
            ? "border-evergreen bg-evergreen text-milk hover:bg-evergreen/90"
            : "border-ink bg-surface text-ink hover:bg-mint"
        }`}
      >
        {listening ? (
          <Mic aria-hidden="true" className="h-6 w-6" />
        ) : (
          <MicOff aria-hidden="true" className="h-6 w-6" />
        )}
      </button>

      {/* Portaled to <body> with viewport-fixed coordinates computed from the
          button (see the position effect above) so the popover always paints
          above page content — including `rise-in`-animated ancestors, which
          establish their own stacking context and would otherwise trap a
          same-tree z-index popover behind later siblings. */}
      {showPanel && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="group"
              aria-label="Voice commands"
              style={{ top: panelPos.top, right: panelPos.right }}
              className="rise-in fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-line-strong bg-surface p-4 text-left shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-raspberry">
                  {micState === "unavailable"
                    ? "Voice control"
                    : "Say a command"}
                </p>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close voice command guide"
                  className="-mr-1 -mt-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mint hover:text-ink"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              {micState === "unavailable" ? (
                <p className="mt-2 text-base text-ink">
                  The microphone couldn&apos;t start, so voice control is off
                  for now. Everything here still works by touch and keyboard.
                </p>
              ) : (
                <>
                  <ul className="mt-3 flex flex-col gap-2">
                    {commands.map((command) => (
                      <li
                        key={command}
                        className="flex items-baseline justify-between gap-3 text-ink"
                      >
                        <span className="font-semibold">
                          “{VOICE_COMMAND_PHRASES[command][0]}”
                        </span>
                        <span className="text-sm text-ink-soft">
                          {COMMAND_HINTS[command]}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="mt-3 border-t border-line pt-2 text-xs text-ink-soft"
                    aria-live="polite"
                  >
                    {heard === null
                      ? "Listening… every control also works by touch."
                      : "command" in heard
                        ? `Heard “${VOICE_COMMAND_PHRASES[heard.command][0]}”.`
                        : `Heard “${heard.unmatched}” — try a command word.`}
                  </p>
                </>
              )}
            </div>,
            document.body,
          )
        : null}

      {/* Always-present status for screen readers, even with the popover
          dismissed, so the on/off/unavailable state is never silent. */}
      <p className="sr-only" aria-live="polite">
        {micState === "listening"
          ? "Voice control is on and listening for commands."
          : micState === "unavailable"
            ? "The microphone couldn't start, so voice control is off. Everything here still works by touch and keyboard."
            : "Voice control is off."}
      </p>
    </div>
  );
}
