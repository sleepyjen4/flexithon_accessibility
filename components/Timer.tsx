"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProfileStore } from "@/store/profile";
import { Button } from "@/components/Button";

interface TimerProps {
  seconds: number;
  label: string;
  onComplete?: () => void;
  onPauseChange?: (paused: boolean) => void;
  /** Controlled pause (F8 voice control): when set, the timer's running state
   * follows this prop, and the built-in Pause button only reports the request
   * through onPauseChange — the parent owns the state. */
  paused?: boolean;
  /** Increment to add 30 seconds from the parent (the "add time" voice
   * command) — same effect as the +30 seconds button. */
  extendSignal?: number;
  /** "plain" (default) shows the big number; "ring" shows a circular countdown
   * that depletes as time runs out — used on the rest screen. */
  variant?: "plain" | "ring";
}

function formatTime(total: number): string {
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// Ring geometry (viewBox is 120×120, so a radius of 48 leaves room for the
// 14-unit stroke). The circumference is the dash length we animate against.
const RING_RADIUS = 48;
const RING_STROKE = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** F5 timer: pause-friendly, extendable, announces state changes via
 * aria-live (Section 6, rule 5) — never a per-second announcement. */
export function Timer({
  seconds,
  label,
  onComplete,
  onPauseChange,
  paused,
  extendSignal = 0,
  variant = "plain",
}: TimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  // Denominator for the ring's progress; grows with "+30 seconds" so the ring
  // stays proportional. Unused by the plain variant.
  const [total, setTotal] = useState(seconds);
  const [internalRunning, setInternalRunning] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const haptics = useProfileStore((state) => state.prefs.haptics);
  const completedRef = useRef(false);

  // Uncontrolled by default; a `paused` prop switches to controlled mode so a
  // parent (e.g. voice control in the workout player) can pause hands-free.
  const running = paused === undefined ? internalRunning : !paused;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(
      () => setRemaining((current) => (current > 0 ? current - 1 : 0)),
      1000,
    );
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && !completedRef.current) {
      completedRef.current = true;
      setAnnouncement(`${label} timer finished.`);
      if (haptics && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(200);
      }
      onComplete?.();
    }
  }, [remaining, label, haptics, onComplete]);

  const togglePause = () => {
    // Derive the next state from the current render's `running` and run all
    // side effects here in the handler — never inside a setState updater,
    // which runs during render and can't notify the parent (onPauseChange).
    // `nextPaused` is the post-toggle state (running now → paused next), so
    // the parent receives the value that matches the UI it will render after
    // this click. In controlled mode the parent applies it via the prop.
    const nextPaused = running;
    if (paused === undefined) setInternalRunning(!running);
    setAnnouncement(
      nextPaused
        ? `Paused with ${formatTime(remaining)} left.`
        : "Timer resumed.",
    );
    onPauseChange?.(nextPaused);
  };

  const extend = useCallback(() => {
    completedRef.current = false;
    setRemaining((current) => current + 30);
    setTotal((current) => current + 30);
    setAnnouncement("Added 30 seconds.");
  }, []);

  // Voice-driven +30 seconds. Initialized to the mounting value so a timer
  // keyed in mid-session (next step's timer) ignores past signals; deferred a
  // tick so the state updates land outside the effect body.
  const handledExtendSignalRef = useRef(extendSignal);
  useEffect(() => {
    if (extendSignal === handledExtendSignalRef.current) return;
    handledExtendSignalRef.current = extendSignal;
    const timer = setTimeout(extend, 0);
    return () => clearTimeout(timer);
  }, [extendSignal, extend]);

  const liveRegion = (
    <p aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );

  const controls = (
    <div className="flex w-full gap-3">
      <Button type="button" variant="secondary" onClick={togglePause}>
        {running ? "Pause" : "Resume"}
      </Button>
      <Button type="button" variant="secondary" onClick={extend}>
        +30 seconds
      </Button>
    </div>
  );

  if (variant === "ring") {
    const fraction =
      total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
    const dashoffset = RING_CIRCUMFERENCE * (1 - fraction);

    return (
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-56 w-56">
          <svg
            viewBox="0 0 120 120"
            className="h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--line)"
              strokeWidth={RING_STROKE}
            />
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--raspberry)"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashoffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-display text-5xl font-extrabold tabular-nums text-ink"
              aria-hidden="true"
            >
              {formatTime(remaining)}
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
              {label}
            </span>
          </div>
        </div>
        {liveRegion}
        {controls}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p
        className="text-5xl font-bold tabular-nums text-ink"
        aria-hidden="true"
      >
        {formatTime(remaining)}
      </p>
      {liveRegion}
      {controls}
    </div>
  );
}
