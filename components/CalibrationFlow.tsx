"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PersonalRange } from "@/types";
import {
  DEFAULT_RANGE,
  MIN_CALIBRATION_SWEEP_DEGREES,
  computeRange,
  isUsableSweep,
} from "@/lib/calibration";
import { getExerciseById } from "@/lib/exercises";
import { useShoulderAngle } from "@/lib/pose/useShoulderAngle";
import { useCalibrationStore } from "@/store/calibration";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

/** The one exercise with hands-free rep counting (Section 5b, F9). */
const HERO_EXERCISE_ID = "seated_lateral_raise";
const TARGET_SWEEPS = 3; // three guided movements (T08).

type Phase = "intro" | "capture" | "review";

/**
 * T08: guided calibration for the hands-free hero exercise. Records the user's
 * own comfortable min/max shoulder angle over a few movements, stores it as a
 * `PersonalRange`, and heads to the workout. Fully keyboard-operable, and the
 * camera is always optional — the flow never dead-ends.
 */
export function CalibrationFlow() {
  const router = useRouter();
  const setRange = useCalibrationStore((state) => state.setRange);
  const existing = useCalibrationStore((state) => state.ranges[HERO_EXERCISE_ID]);
  const exercise = getExerciseById(HERO_EXERCISE_ID);

  const [phase, setPhase] = useState<Phase>("intro");
  const [liveDeg, setLiveDeg] = useState<number | null>(null);
  const [captMin, setCaptMin] = useState<number | null>(null);
  const [captMax, setCaptMax] = useState<number | null>(null);
  const [sweeps, setSweeps] = useState(0);

  // Running capture lives in refs so 30fps updates never re-render.
  const minRef = useRef<number | null>(null);
  const maxRef = useRef<number | null>(null);
  const sweepArmedRef = useRef(false);
  const sweepsRef = useRef(0);
  const roundedLiveRef = useRef<number | null>(null);

  const handleAngle = useCallback((deg: number | null) => {
    if (deg === null) return; // landmarks dropped — say nothing, keep going.
    const rounded = Math.round(deg);
    if (rounded !== roundedLiveRef.current) {
      roundedLiveRef.current = rounded;
      setLiveDeg(rounded);
    }
    if (minRef.current === null || deg < minRef.current) {
      minRef.current = deg;
      setCaptMin(Math.round(deg));
    }
    if (maxRef.current === null || deg > maxRef.current) {
      maxRef.current = deg;
      setCaptMax(Math.round(deg));
    }
    // Count a full raise-and-lower once we've seen a real range of movement.
    const span = maxRef.current - minRef.current;
    if (span >= MIN_CALIBRATION_SWEEP_DEGREES) {
      const upThreshold = minRef.current + span * 0.6;
      const downThreshold = minRef.current + span * 0.3;
      if (!sweepArmedRef.current && deg > upThreshold) {
        sweepArmedRef.current = true;
      } else if (sweepArmedRef.current && deg < downThreshold) {
        sweepArmedRef.current = false;
        sweepsRef.current += 1;
        setSweeps(sweepsRef.current);
        // Enough guided movements captured — confirm the range.
        if (sweepsRef.current >= TARGET_SWEEPS) setPhase("review");
      }
    }
  }, []);

  const { videoRef, status } = useShoulderAngle({
    enabled: phase === "capture",
    onAngle: handleAngle,
  });

  const beginCapture = () => {
    minRef.current = null;
    maxRef.current = null;
    sweepArmedRef.current = false;
    sweepsRef.current = 0;
    roundedLiveRef.current = null;
    setCaptMin(null);
    setCaptMax(null);
    setLiveDeg(null);
    setSweeps(0);
    setPhase("capture");
  };

  const save = (range: PersonalRange) => {
    setRange(HERO_EXERCISE_ID, range);
    router.push("/workout");
  };

  const saveDefault = () => save({ ...DEFAULT_RANGE, capturedAt: new Date().toISOString() });

  const heading = "Calibrate camera rep counting";

  // ---- Intro -------------------------------------------------------------
  if (phase === "intro") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-lg text-slate-600">
          We&apos;ll learn your comfortable range for the{" "}
          <strong>{exercise?.name ?? "hero exercise"}</strong> so the camera counts
          reps that fit your body — not the other way around.
        </p>
        {existing && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-lg text-slate-900">
            You&apos;re already calibrated ({existing.minDeg}°–{existing.maxDeg}°).
            You can recalibrate any time.
          </p>
        )}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">What happens</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg text-slate-900">
            <li>Sit so your head and arms are in view.</li>
            <li>Raise both arms out to the side as far as is comfortable, then lower.</li>
            <li>Repeat gently {TARGET_SWEEPS} times — we&apos;ll do the measuring.</li>
          </ol>
        </Card>
        <p className="text-base text-slate-600">
          Video stays on your device — nothing is uploaded or stored. Prefer not to
          use the camera? You can skip it and still start your workout.
        </p>
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Button type="button" onClick={beginCapture}>
            {existing ? "Recalibrate with camera" : "Start calibration"}
          </Button>
          <Button type="button" variant="secondary" onClick={saveDefault}>
            Skip camera — use a comfortable default
          </Button>
        </div>
      </div>
    );
  }

  // ---- Capture -----------------------------------------------------------
  if (phase === "capture") {
    if (status === "unavailable") {
      return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-600">
            The camera isn&apos;t available right now. That&apos;s completely fine —
            we&apos;ll use a comfortable default range, and you can count reps by hand.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Button type="button" onClick={saveDefault}>
              Use a default range and start
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPhase("intro")}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    const captured = Math.min(sweeps, TARGET_SWEEPS);
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-lg text-slate-600">
          {status === "loading"
            ? "Starting camera…"
            : "Raise your arms out to the side, then lower. Nice and gentle."}
        </p>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-hidden="true"
          className="w-full -scale-x-100 rounded-2xl bg-slate-50"
        />
        <p aria-live="polite" className="text-center text-xl font-semibold text-slate-900">
          Movement {captured} of {TARGET_SWEEPS} recorded
        </p>
        {liveDeg !== null && (
          <p className="text-center text-lg text-slate-600">
            Current: {liveDeg}° · so far {captMin ?? "–"}°–{captMax ?? "–"}°
          </p>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={() => setPhase("review")}>
            Done — save my range
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPhase("intro")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ---- Review ------------------------------------------------------------
  const usable = captMin !== null && captMax !== null && isUsableSweep(captMin, captMax);
  const range = usable ? computeRange(captMin as number, captMax as number) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
      {range ? (
        <>
          <p aria-live="polite" className="text-lg text-slate-600">
            Great — your comfortable range is{" "}
            <strong>
              {range.minDeg}° to {range.maxDeg}°
            </strong>
            . Reps will count against this, so hitting your target stays realistic.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Button type="button" onClick={() => save(range)}>
              Save and start workout
            </Button>
            <Button type="button" variant="secondary" onClick={beginCapture}>
              Recalibrate
            </Button>
          </div>
        </>
      ) : (
        <>
          <p aria-live="polite" className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-600">
            We didn&apos;t catch a full movement that time — no problem at all. Try
            once more, or start with a comfortable default range.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Button type="button" onClick={beginCapture}>
              Try again
            </Button>
            <Button type="button" variant="secondary" onClick={saveDefault}>
              Use a default range and start
            </Button>
          </div>
        </>
      )}
      <Link
        href="/workout"
        className="min-h-12 content-center text-center text-lg font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
      >
        Skip for now
      </Link>
    </div>
  );
}
