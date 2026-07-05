"use client";

import { useEffect, useRef, useState } from "react";
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
}

function formatTime(total: number): string {
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/** F5 timer: pause-friendly, extendable, announces state changes via
 * aria-live (Section 6, rule 5) — never a per-second announcement. */
export function Timer({
  seconds,
  label,
  onComplete,
  onPauseChange,
  paused,
}: TimerProps) {
  const [remaining, setRemaining] = useState(seconds);
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

  const extend = () => {
    completedRef.current = false;
    setRemaining((current) => current + 30);
    setAnnouncement("Added 30 seconds.");
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p
        className="text-5xl font-bold tabular-nums text-slate-900"
        aria-hidden="true"
      >
        {formatTime(remaining)}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex w-full gap-3">
        <Button type="button" variant="secondary" onClick={togglePause}>
          {running ? "Pause" : "Resume"}
        </Button>
        <Button type="button" variant="secondary" onClick={extend}>
          +30 seconds
        </Button>
      </div>
    </div>
  );
}
