"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExerciseDef, PersonalRange, SafeMovementStats } from "@/types";
import { Button } from "@/components/Button";
import { getExerciseById } from "@/lib/exercises";
import { useCalibrationStore } from "@/store/calibration";
import { useSessionStore } from "@/store/session";

const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
        Loading optional camera tracker.
      </div>
    ),
  },
);

const SUMMARY_EXERCISE_ID = "seated_lateral_raise";

const trackerExercise: ExerciseDef = {
  id: "seated_arm_raise",
  name: "Seated lateral raise",
  landmarks: [13, 11, 23],
  side: "either",
  instructions: [
    "Sit in a supported position.",
    "Raise one arm out to the side toward a comfortable range.",
    "Lower your arm gently when you are ready.",
  ],
  cues: {
    rangeReached: "You reached your target range.",
    encourage: [
      "Move within today’s comfortable range.",
      "Pause whenever you need.",
    ],
  },
};

const demoRange: PersonalRange = {
  minDeg: 15,
  maxDeg: 95,
};

export default function ExercisePage() {
  const router = useRouter();
  const exercise = getExerciseById(SUMMARY_EXERCISE_ID);
  const personalRange =
    useCalibrationStore((state) => state.ranges[SUMMARY_EXERCISE_ID]) ??
    demoRange;
  const setTrackingSummary = useSessionStore(
    (state) => state.setTrackingSummary,
  );
  const startedAtRef = useRef<number | null>(null);
  const [reps, setReps] = useState(0);
  const [peakAngle, setPeakAngle] = useState(0);
  const [safeStats, setSafeStats] = useState<SafeMovementStats | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const finishSession = useCallback(() => {
    if (finished) return;

    setFinished(true);
    setTrackingSummary({
      exerciseId: SUMMARY_EXERCISE_ID,
      reps,
      personalRange,
      peakAngleToday: Math.round(peakAngle),
      safeStats: safeStats ?? undefined,
      startedAt: startedAtRef.current ?? Date.now(),
      endedAt: Date.now(),
    });
    router.push("/summary");
  }, [
    finished,
    peakAngle,
    personalRange,
    reps,
    router,
    safeStats,
    setTrackingSummary,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Exercise tracker demo</h1>
          <p className="text-base text-slate-600">
            Follow the movement instructions. Camera tracking is optional, and
            manual completion is always available.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-bold">
            {exercise?.name ?? trackerExercise.name}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700">
            {trackerExercise.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        </section>

        <PoseTracker
          exercise={trackerExercise}
          personalRange={personalRange}
          onRepCount={setReps}
          onPeakRom={setPeakAngle}
          onMovementStats={setSafeStats}
          onManualDone={finishSession}
        />

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-base text-slate-600">
            Today&apos;s range target: {personalRange.minDeg}°–
            {personalRange.maxDeg}°.
          </p>
          <Button type="button" onClick={finishSession} disabled={finished}>
            Finish and view summary
          </Button>
          <Button asChild variant="secondary">
            <Link href="/calibrate">Recalibrate</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
