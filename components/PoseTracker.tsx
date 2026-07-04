"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonalRange } from "@/types";
import { repThresholds } from "@/lib/calibration";
import { useShoulderAngle } from "@/lib/pose/useShoulderAngle";

// Fallback hysteresis when the user hasn't calibrated: count "up" past 80°...
const REP_UP_DEGREES = 80;
const REP_DOWN_DEGREES = 30; // ...and re-arm only after dropping below 30°.

interface PoseTrackerProps {
  onPeakRom?: (degrees: number) => void;
  /** Personal range from calibration (T08); scales rep counting to this body. */
  range?: PersonalRange;
}

/** F9: on-device rep counting + peak range-of-motion for the hero
 * exercise. Video never leaves the browser. Never judges form. */
export function PoseTracker({ onPeakRom, range }: PoseTrackerProps) {
  const [repCount, setRepCount] = useState(0);
  const [peakRom, setPeakRom] = useState(0);

  const onPeakRomRef = useRef(onPeakRom);
  useEffect(() => {
    onPeakRomRef.current = onPeakRom;
  }, [onPeakRom]);

  // Rep state machine lives in refs so per-frame updates never re-render.
  const armRaisedRef = useRef(false);
  const peakRef = useRef(0);

  const { up, down } = range
    ? repThresholds(range)
    : { up: REP_UP_DEGREES, down: REP_DOWN_DEGREES };

  const handleAngle = useCallback(
    (smoothed: number | null) => {
      if (smoothed === null) return; // landmarks dropped — pause silently.
      if (smoothed > peakRef.current) {
        peakRef.current = smoothed;
        const rounded = Math.round(smoothed);
        setPeakRom(rounded);
        onPeakRomRef.current?.(rounded);
      }
      if (!armRaisedRef.current && smoothed > up) {
        armRaisedRef.current = true;
        setRepCount((count) => count + 1);
      } else if (armRaisedRef.current && smoothed < down) {
        armRaisedRef.current = false;
      }
    },
    [up, down],
  );

  const { videoRef, status } = useShoulderAngle({ enabled: true, onAngle: handleAngle });

  if (status === "unavailable") {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-600">
        The camera isn&apos;t available right now. Counting by hand works
        exactly the same — tap Done when you&apos;re finished.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className="w-full -scale-x-100 rounded-2xl bg-slate-50"
      />
      <p aria-live="polite" className="text-center text-2xl font-bold text-slate-900">
        {status === "loading"
          ? "Starting camera…"
          : `${repCount} ${repCount === 1 ? "rep" : "reps"}`}
      </p>
      {status === "tracking" && (
        <p className="text-center text-lg text-slate-600">
          Peak range of motion: {peakRom}°
        </p>
      )}
      <p className="text-center text-base text-slate-600">
        Video stays on your device — nothing is uploaded or stored.
      </p>
    </div>
  );
}
