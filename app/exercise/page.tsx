"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pause, Play } from "lucide-react";
import { Button } from "@/components/Button";
import { PoseSetup } from "@/components/PoseSetup";
import { SpeechToggle } from "@/components/SpeechToggle";
import {
  CALIBRATION_KEY_BY_POSE_ID,
  getPoseExerciseById,
  poseExerciseForSide,
} from "@/lib/pose/exercises";
import { getExerciseAudioUrl } from "@/lib/audioManifest";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";
import { UP_THRESHOLD_FRACTION } from "@/lib/pose/repCounter";
import { useCalibrationStore } from "@/store/calibration";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";
import type {
  ExerciseDef,
  PersonalRange,
  RepEvent,
  SafeMovementStats,
} from "@/types";

type PoseExerciseId = ExerciseDef["id"];
type TrackedSide = ExerciseDef["side"];

const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
        Loading the camera tracker...
      </div>
    ),
  },
);

// Pre-calibration fallback only: rep counting is range-relative, so once a user
// calibrates (T08) their own range replaces this for whichever movement they
// pick. Each movement's calibration is keyed per exercise via
// CALIBRATION_KEY_BY_POSE_ID (the store lives under the workout-library id).
const DEFAULT_RANGE: PersonalRange = { minDeg: 15, maxDeg: 95 };

function targetAngle(range: PersonalRange): number {
  // Single source of truth with the rep counter + RangeArc, so the target can
  // never drift from the angle a rep actually has to reach.
  return Math.round(
    range.minDeg + UP_THRESHOLD_FRACTION * (range.maxDeg - range.minDeg),
  );
}

export default function ExercisePage() {
  const router = useRouter();

  const [exerciseId, setExerciseId] = useState<PoseExerciseId>(
    "seated_arm_raise",
  );
  const [side, setSide] = useState<TrackedSide>("either");

  const calibrationKey = CALIBRATION_KEY_BY_POSE_ID[exerciseId];
  const calibratedRange = useCalibrationStore(
    (state) => state.ranges[calibrationKey],
  );
  const recordRom = useSessionStore((state) => state.recordRom);
  const setTrackingSummary = useSessionStore(
    (state) => state.setTrackingSummary,
  );
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

  const startedAtRef = useRef<number | null>(null);
  const repsRef = useRef(0);
  const peakRef = useRef(0);
  const safeStatsRef = useRef<SafeMovementStats | null>(null);

  // Stop any in-flight speech (rep counts / read-aloud) when leaving the page.
  useEffect(() => cancelSpeech, []);

  // The chosen movement, resolved to a single tracked side (T13 single-limb).
  const poseExercise = useMemo(
    () => poseExerciseForSide(getPoseExerciseById(exerciseId)!, side),
    [exerciseId, side],
  );

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const range = calibratedRange ?? DEFAULT_RANGE;

  // Switching movement or side is a fresh set: clear the read-outs and drop out
  // of the finished/paused state. The tracker itself remounts via `key` below,
  // which tears the camera down so the user restarts it for the new setup.
  const resetSession = useCallback(() => {
    setReps(0);
    setPeak(0);
    setPaused(false);
    setFinished(false);
    setLiveMessage("");
  }, []);

  const changeExercise = useCallback(
    (id: PoseExerciseId) => {
      setExerciseId(id);
      resetSession();
    },
    [resetSession],
  );

  const changeSide = useCallback(
    (next: TrackedSide) => {
      setSide(next);
      resetSession();
    },
    [resetSession],
  );

  // Rep counts are spoken by PoseTracker (T09 announceRepCount, global mute);
  // here we only mirror events visually and keep the reps/peak read-outs.
  const handleRepEvent = useCallback((event: RepEvent) => {
    switch (event.type) {
      case "rep":
        repsRef.current = event.count;
        setReps(event.count);
        setLiveMessage(`Rep ${event.count} counted.`);
        break;
      case "range_reached":
        setLiveMessage(poseExercise.cues.rangeReached);
        break;
      case "tracking_paused":
        setLiveMessage("Move back into view whenever you can -- no rush.");
        break;
      case "tracking_resumed":
        setLiveMessage("Tracking resumed.");
        break;
    }
  }, [poseExercise]);

  const handlePeak = useCallback((degrees: number) => {
    peakRef.current = degrees;
    setPeak(degrees);
  }, []);

  const handleMovementStats = useCallback((stats: SafeMovementStats) => {
    safeStatsRef.current = stats;
  }, []);

  const playInstructions = useCallback(() => {
    const text = [poseExercise.name, ...poseExercise.instructions].join(". ");
    // Google AI Studio clip is the primary voice (Section 5c); speakOrPlay
    // falls back to Web Speech only if the clip is missing or its playback is
    // blocked. Resolves when it ends, is stopped, or no-ops (muted).
    setReading(true);
    void speakOrPlay(
      getExerciseAudioUrl({ id: poseExercise.id, audio_url: null }),
      text,
      { interrupt: true },
    ).finally(() => setReading(false));
  }, [poseExercise]);

  const readAloud = useCallback(() => {
    // Play/stop toggle: a second tap stops the clip mid-way.
    if (reading) {
      cancelSpeech();
      setReading(false);
      return;
    }
    playInstructions();
  }, [reading, playInstructions]);

  // Autoplay the instructions the first time the screen opens, so an unmuted
  // user hears them without tapping play -- matching the workout player.
  // speakOrPlay no-ops while muted, so the corner toggle governs autoplay too.
  // Keyed on the movement only (via a ref for the latest player): switching
  // sides doesn't change the instruction text, so it must not re-narrate.
  const playInstructionsRef = useRef(playInstructions);
  useEffect(() => {
    playInstructionsRef.current = playInstructions;
  }, [playInstructions]);
  useEffect(() => {
    // Deferred a tick so the play-state update lands outside the effect body.
    const timer = setTimeout(() => playInstructionsRef.current(), 0);
    return () => clearTimeout(timer);
  }, [exerciseId]);

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      if (next) cancelSpeech();
      setLiveMessage(next ? "Paused." : "Resumed.");
      return next;
    });
  }, []);

  const finish = useCallback(() => {
    if (finished) return;

    const peakToday = peakRef.current;
    cancelSpeech();
    setPaused(false);
    setFinished(true);
    if (peakToday > 0) recordRom(calibrationKey, peakToday);
    setTrackingSummary({
      exerciseId: calibrationKey,
      reps: repsRef.current,
      personalRange: range,
      peakAngleToday: Math.round(peakToday),
      safeStats: safeStatsRef.current ?? undefined,
      startedAt: startedAtRef.current ?? Date.now(),
      endedAt: Date.now(),
    });
    setLiveMessage("Exercise complete. Nice work showing up today.");
    router.push("/summary");
  }, [calibrationKey, finished, range, recordRom, router, setTrackingSummary]);

  const goAgain = useCallback(() => {
    startedAtRef.current = Date.now();
    repsRef.current = 0;
    peakRef.current = 0;
    safeStatsRef.current = null;
    setFinished(false);
    setReps(0);
    setPeak(0);
    setPaused(false);
    setLiveMessage("");
    setSessionKey((key) => key + 1); // remount the tracker for a clean count
    playInstructions();
  }, [playInstructions]);

  // Carry the current movement and side into calibration so it captures the
  // range for exactly what the user is about to track (T13 single-limb).
  const calibrateHref = `/calibrate?exercise=${exerciseId}&side=${side}`;

  return (
    <div className="min-h-screen bg-cream px-4 py-6 text-ink sm:px-6 lg:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Page-level so the speech toggle stays visible across every state
            (setup, tracking, finished) -- otherwise a user who muted elsewhere
            lands here with no way to turn spoken counts back on. */}
        <div className="rise-in flex items-start justify-between gap-3">
          <header className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-raspberry">
              Tracked exercise
            </p>
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
              {poseExercise.name}
            </h1>
            <p className="max-w-2xl text-base text-ink-soft">
              Hands-free rep counting, scored against your own range. The camera
              is optional and everything below works if you keep it off.
            </p>
          </header>
          <SpeechToggle />
        </div>

        {/* Every spoken cue has a visual twin here (AGENTS.md Section 6). */}
        <p className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </p>

        {finished ? (
          <FinishedCard
            reps={reps}
            peak={peak}
            target={targetAngle(range)}
            calibrateHref={calibrateHref}
            onGoAgain={goAgain}
          />
        ) : (
          <>
            {/* Instructions sit above everything so users see how to move right
                away -- before the camera or setup, on every screen size. The
                marigold border and full-width band make it stand out. */}
            <section className="rise-in rise-in-2 rounded-3xl border-2 border-marigold bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold">How to move</h2>
                {/* Hidden while speech is muted -- nothing would play, so the
                    corner mute toggle is the only relevant control then. */}
                {speechEnabled ? (
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={readAloud}
                    aria-pressed={reading}
                    className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink transition-colors hover:bg-mint"
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
              <ol className="mt-4 grid gap-3 text-ink sm:grid-cols-2 lg:grid-cols-3">
                {poseExercise.instructions.map((instruction, index) => (
                  <li key={instruction} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marigold-soft text-base font-bold text-marigold-deep"
                    >
                      {index + 1}
                    </span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {/* The camera stage leads the grid below the instructions: it is the
                product's hero and dominates the grid. */}
            <div className="rise-in rise-in-3 flex flex-col gap-4">
              <PoseTracker
                key={`${exerciseId}:${side}:${sessionKey}`}
                exercise={poseExercise}
                personalRange={range}
                paused={paused}
                onRepEvent={handleRepEvent}
                onPeakRom={handlePeak}
                onMovementStats={handleMovementStats}
                onManualDone={finish}
                onActiveChange={setActive}
              />
            </div>

            <div className="rise-in rise-in-4 flex flex-col gap-4">
              <PoseSetup
                exerciseId={exerciseId}
                side={side}
                onExerciseChange={changeExercise}
                onSideChange={changeSide}
                disabled={active}
              />

              {!calibratedRange ? (
                <div className="rounded-3xl bg-lavender p-5">
                  <h2 className="font-display text-lg font-bold text-ink">
                    Counting to a general range
                  </h2>
                  <p className="mt-1 text-base text-ink">
                    For counting tuned to how you move today, calibrate first.
                    You can also carry on with a general range right now.
                  </p>
                  <Link
                    href={calibrateHref}
                    className="mt-2 inline-flex min-h-12 items-center font-semibold text-ink underline underline-offset-4 hover:text-raspberry"
                  >
                    Calibrate my range
                  </Link>
                </div>
              ) : (
                <div className="rounded-3xl border border-line bg-surface p-5 text-ink-soft shadow-card">
                  Counting against your calibrated range:{" "}
                  <span className="font-semibold text-ink">
                    {range.minDeg}°-{range.maxDeg}°
                  </span>{" "}
                  (target {targetAngle(range)}°).{" "}
                  <Link
                    href={calibrateHref}
                    className="font-semibold text-ink underline underline-offset-4 hover:text-raspberry"
                  >
                    Recalibrate
                  </Link>
                </div>
              )}
            </div>
            </div>

            {/* Primary session controls: set apart at the bottom of the flow
                with a divider so they read as the main actions on every screen,
                distinct from the setup and in-camera controls above. */}
            <div className="rise-in rise-in-4 flex flex-col gap-3 border-t-2 border-line-strong pt-6 sm:flex-row">
              <Button
                type="button"
                onClick={togglePause}
                disabled={!active}
                aria-pressed={paused}
              >
                {paused ? "Resume tracking" : "Pause tracking"}
              </Button>

              <Button type="button" variant="secondary" onClick={finish}>
                Finish and view summary
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FinishedCard({
  reps,
  peak,
  target,
  calibrateHref,
  onGoAgain,
}: {
  reps: number;
  peak: number;
  target: number;
  calibrateHref: string;
  onGoAgain: () => void;
}) {
  const reachedTarget = peak >= target;

  return (
    <section className="on-dark rise-in mx-auto w-full max-w-2xl rounded-3xl bg-evergreen p-6 shadow-card sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-milk-soft">
        Session done
      </p>
      <h2 className="mt-2 font-display text-3xl font-extrabold text-milk">
        {reps > 0 ? "That counts. Every rep." : "You showed up today."}
      </h2>
      <p className="mt-2 text-base text-milk">
        {reps > 0
          ? `You moved through ${reps} ${reps === 1 ? "rep" : "reps"} at your own pace.`
          : "Turning up is the hard part, and you did it."}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-mint p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-evergreen">
            Reps
          </p>
          <p className="text-3xl font-bold tabular-nums text-ink">{reps}</p>
        </div>
        <div className="rounded-2xl bg-mint p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-evergreen">
            Peak range today
          </p>
          <p className="text-3xl font-bold tabular-nums text-ink">{peak}°</p>
          <p className="mt-1 text-sm text-ink">
            {reachedTarget
              ? "You reached your target range."
              : `Target ${target}° -- worth celebrating either way.`}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onGoAgain}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-milk px-6 text-lg font-bold text-ink transition-colors hover:bg-cream"
        >
          Go again
        </button>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href={calibrateHref}
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-milk px-4 text-center text-base font-bold text-milk transition-colors hover:bg-white/10"
          >
            Recalibrate
          </Link>
          <Link
            href="/summary"
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-milk px-4 text-center text-base font-bold text-milk transition-colors hover:bg-white/10"
          >
            View summary
          </Link>
          <Link
            href="/"
            aria-label="Finish and return to dashboard"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-milk px-4 text-center text-base font-bold text-milk transition-colors hover:bg-white/10"
          >
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            <span>Finish</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
