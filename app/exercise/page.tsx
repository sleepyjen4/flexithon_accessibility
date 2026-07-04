"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileAudio } from "lucide-react";
import type { PersonalRange, SafeMovementStats } from "@/types";
import { Button } from "@/components/Button";
import { getExerciseById } from "@/lib/exercises";
import { POSE_EXERCISES, getPoseExerciseById } from "@/lib/pose/exercises";
import { getExerciseAudioUrl } from "@/lib/audioManifest";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";
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
const trackerExercise =
  getPoseExerciseById("seated_arm_raise") ?? POSE_EXERCISES[0];

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

  const readAloud = useCallback(() => {
    const text = [trackerExercise.name, ...trackerExercise.instructions].join(
      ". ",
    );
    void speakOrPlay(
      getExerciseAudioUrl({ id: SUMMARY_EXERCISE_ID, audio_url: null }),
      text,
      { interrupt: true },
    );
  }, []);

  useEffect(() => cancelSpeech, []);

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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">
              {exercise?.name ?? trackerExercise.name}
            </h2>
            <button
              type="button"
              onClick={readAloud}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              aria-label={`Read aloud the instructions for ${exercise?.name ?? trackerExercise.name}`}
            >
              <FileAudio aria-hidden="true" />
            </button>
          </div>
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
