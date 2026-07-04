"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/Button";
import { SpeechToggle } from "@/components/SpeechToggle";
import { getPoseExerciseById } from "@/lib/pose/exercises";
import { getExerciseAudioUrl } from "@/lib/audioManifest";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";
import { UP_THRESHOLD_FRACTION } from "@/lib/pose/repCounter";
import { useCalibrationStore } from "@/store/calibration";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";
import type { PersonalRange, RepEvent } from "@/types";

const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
        Loading the camera tracker…
      </div>
    ),
  },
);

// The range calibrated in T08 is stored under the workout-library id for the
// F9 hero exercise; the pose landmark math uses the matching pose def. These
// two ids name the same movement in two id namespaces (a known pre-existing
// wart) — keep them in lockstep here.
const CALIBRATION_KEY = "seated_lateral_raise";
const poseExercise = getPoseExerciseById("seated_arm_raise")!;

const DEFAULT_RANGE: PersonalRange = { minDeg: 15, maxDeg: 95 };

function targetAngle(range: PersonalRange): number {
  // Single source of truth with the rep counter + RangeArc, so the target can
  // never drift from the angle a rep actually has to reach.
  return Math.round(
    range.minDeg + UP_THRESHOLD_FRACTION * (range.maxDeg - range.minDeg),
  );
}

export default function ExercisePage() {
  const calibratedRange = useCalibrationStore(
    (state) => state.ranges[CALIBRATION_KEY],
  );
  const recordRom = useSessionStore((state) => state.recordRom);
  const speechEnabled = useProfileStore(
    (state) => state.prefs.speech_enabled !== false,
  );

  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reps, setReps] = useState(0);
  const [peak, setPeak] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const [reading, setReading] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  // Stop any in-flight speech (rep counts / read-aloud) when leaving the page.
  useEffect(() => cancelSpeech, []);

  const range = calibratedRange ?? DEFAULT_RANGE;

  // Rep counts are spoken by PoseTracker (T09 announceRepCount, global mute);
  // here we only mirror events visually and keep the reps/peak read-outs.
  const handleRepEvent = useCallback((event: RepEvent) => {
    switch (event.type) {
      case "rep":
        setReps(event.count);
        setLiveMessage(`Rep ${event.count} counted.`);
        break;
      case "range_reached":
        setLiveMessage(poseExercise.cues.rangeReached);
        break;
      case "tracking_paused":
        setLiveMessage("Move back into view whenever you can — no rush.");
        break;
      case "tracking_resumed":
        setLiveMessage("Tracking resumed.");
        break;
    }
  }, []);

  const handlePeak = useCallback((degrees: number) => setPeak(degrees), []);

  const readAloud = useCallback(() => {
    // Play/stop toggle: a second tap stops the clip mid-way.
    if (reading) {
      cancelSpeech();
      setReading(false);
      return;
    }
    const text = [poseExercise.name, ...poseExercise.instructions].join(". ");
    // Prefer the pre-generated clip (Section 5c); speakOrPlay falls back to the
    // Web Speech API when no clip exists. Resolves when it ends, is stopped, or
    // no-ops (speech muted) — reset to the Play state either way.
    setReading(true);
    void speakOrPlay(
      getExerciseAudioUrl({ id: poseExercise.id, audio_url: null }),
      text,
      { interrupt: true },
    ).finally(() => setReading(false));
  }, [reading]);

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      if (next) cancelSpeech();
      setLiveMessage(next ? "Paused." : "Resumed.");
      return next;
    });
  }, []);

  const finish = useCallback(() => {
    cancelSpeech();
    setPaused(false);
    setFinished(true);
    if (peak > 0) recordRom(CALIBRATION_KEY, peak);
    setLiveMessage("Exercise complete. Nice work showing up today.");
  }, [peak, recordRom]);

  const goAgain = useCallback(() => {
    setFinished(false);
    setReps(0);
    setPeak(0);
    setPaused(false);
    setLiveMessage("");
    setSessionKey((key) => key + 1); // remount the tracker for a clean count
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* Page-level so the speech toggle stays visible across every state
            (setup, tracking, finished) — otherwise a user who muted elsewhere
            lands here with no way to turn spoken counts back on. */}
        <div className="flex items-start justify-between gap-3">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold">{poseExercise.name}</h1>
            <p className="text-base text-slate-600">
              Hands-free rep counting, scored against your own range. The camera
              is optional and everything below works if you keep it off.
            </p>
          </header>
          <SpeechToggle />
        </div>

        {/* Every spoken cue has a visual twin here (AGENTS.md §6). */}
        <p className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </p>

        {finished ? (
          <FinishedCard
            reps={reps}
            peak={peak}
            target={targetAngle(range)}
            onGoAgain={goAgain}
          />
        ) : (
          <>
            {!calibratedRange ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-slate-800">
                <h2 className="text-lg font-semibold text-slate-900">
                  Counting to a general range
                </h2>
                <p className="mt-1 text-base">
                  For counting tuned to how you move today, calibrate first. You
                  can also carry on with a general range right now.
                </p>
                <Link
                  href="/calibrate"
                  className="mt-3 inline-flex min-h-12 items-center font-semibold text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
                >
                  Calibrate my range
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-4 text-slate-700 shadow-sm ring-1 ring-slate-200">
                Counting against your calibrated range:{" "}
                <span className="font-semibold text-slate-900">
                  {range.minDeg}°–{range.maxDeg}°
                </span>{" "}
                (target {targetAngle(range)}°).{" "}
                <Link
                  href="/calibrate"
                  className="font-semibold text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
                >
                  Recalibrate
                </Link>
              </div>
            )}

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">How to move</h2>
                {/* Hidden while speech is muted — nothing would play, so the
                    corner mute toggle is the only relevant control then. */}
                {speechEnabled ? (
                  <button
                    type="button"
                    onClick={readAloud}
                    aria-pressed={reading}
                    className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    aria-label={
                      reading
                        ? `Stop reading the instructions for ${poseExercise.name}`
                        : `Play the instructions for ${poseExercise.name} from the start`
                    }
                  >
                    {reading ? (
                      <Pause aria-hidden="true" className="h-6 w-6" />
                    ) : (
                      <Play aria-hidden="true" className="h-6 w-6" />
                    )}
                  </button>
                ) : null}
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700">
                {poseExercise.instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
            </section>

            <PoseTracker
              key={sessionKey}
              exercise={poseExercise}
              personalRange={range}
              paused={paused}
              onRepEvent={handleRepEvent}
              onPeakRom={handlePeak}
              onManualDone={finish}
              onActiveChange={setActive}
            />

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                onClick={togglePause}
                disabled={!active}
                aria-pressed={paused}
              >
                {paused ? "Resume tracking" : "Pause tracking"}
              </Button>

              <Button type="button" variant="secondary" onClick={finish}>
                Finish exercise
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function FinishedCard({
  reps,
  peak,
  target,
  onGoAgain,
}: {
  reps: number;
  peak: number;
  target: number;
  onGoAgain: () => void;
}) {
  const reachedTarget = peak >= target;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-2xl font-bold text-slate-900">
        {reps > 0 ? "That counts. Every rep." : "You showed up today."}
      </h2>
      <p className="mt-2 text-base text-slate-600">
        {reps > 0
          ? `You moved through ${reps} ${reps === 1 ? "rep" : "reps"} at your own pace.`
          : "Turning up is the hard part, and you did it."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Reps</p>
          <p className="text-3xl font-bold text-slate-900">{reps}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Peak range today</p>
          <p className="text-3xl font-bold text-slate-900">{peak}°</p>
          <p className="mt-1 text-sm text-slate-600">
            {reachedTarget
              ? "You reached your target range."
              : `Target ${target}° — worth celebrating either way.`}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={onGoAgain}>
          Go again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/calibrate">Recalibrate range</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/progress">See progress</Link>
        </Button>
      </div>
    </section>
  );
}
