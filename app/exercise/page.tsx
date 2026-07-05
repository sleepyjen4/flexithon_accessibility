"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/Button";
import { PoseSetup } from "@/components/PoseSetup";
import { SpeechToggle } from "@/components/SpeechToggle";
import { VoiceControl } from "@/components/VoiceControl";
import {
  CALIBRATION_KEY_BY_POSE_ID,
  getPoseExerciseById,
  poseExerciseForSide,
} from "@/lib/pose/exercises";
import { getExerciseAudioUrl } from "@/lib/audioManifest";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";
import { setSpeechEnabled } from "@/lib/prefs";
import { UP_THRESHOLD_FRACTION } from "@/lib/pose/repCounter";
import { useCalibrationStore } from "@/store/calibration";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";
import type {
  ExerciseDef,
  PersonalRange,
  RepEvent,
  SafeMovementStats,
  VoiceCommand,
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
  const [cameraStartSignal, setCameraStartSignal] = useState(0);

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

  // T17/W1: the five-phrase grammar, mapped to this screen's controls. Each
  // action already announces itself ("Paused.", camera status) via the
  // existing aria-live regions, so heard commands need no extra announcement.
  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      switch (command) {
        case "start":
          // Camera off -> start it; already tracking but paused -> pick back up.
          if (!active) setCameraStartSignal((signal) => signal + 1);
          else if (paused) togglePause();
          break;
        case "pause":
          if (active && !paused) togglePause();
          break;
        case "resume":
          if (active && paused) togglePause();
          break;
        case "finish":
          finish();
          break;
        case "repeat":
          // Replay the instructions from the start (same as the play button).
          playInstructions();
          break;
        case "mute":
          setSpeechEnabled(false);
          setLiveMessage("Spoken instructions off.");
          break;
        case "unmute":
          setSpeechEnabled(true);
          setLiveMessage("Spoken instructions on.");
          break;
      }
    },
    [active, paused, togglePause, finish, playInstructions],
  );

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
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* Page-level so the speech toggle stays visible across every state
            (setup, tracking, finished) -- otherwise a user who muted elsewhere
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
            <PoseSetup
              exerciseId={exerciseId}
              side={side}
              onExerciseChange={changeExercise}
              onSideChange={changeSide}
              disabled={active}
            />

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
                  href={calibrateHref}
                  className="mt-3 inline-flex min-h-12 items-center font-semibold text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
                >
                  Calibrate my range
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-4 text-slate-700 shadow-sm ring-1 ring-slate-200">
                Counting against your calibrated range:{" "}
                <span className="font-semibold text-slate-900">
                  {range.minDeg}°-{range.maxDeg}°
                </span>{" "}
                (target {targetAngle(range)}°).{" "}
                <Link
                  href={calibrateHref}
                  className="font-semibold text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
                >
                  Recalibrate
                </Link>
              </div>
            )}

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">How to move</h2>
                {/* Hidden while speech is muted -- nothing would play, so the
                    corner mute toggle is the only relevant control then. */}
                {speechEnabled ? (
                  <button
                    type="button"
                    suppressHydrationWarning
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
              key={`${exerciseId}:${side}:${sessionKey}`}
              exercise={poseExercise}
              personalRange={range}
              paused={paused}
              onRepEvent={handleRepEvent}
              onPeakRom={handlePeak}
              onMovementStats={handleMovementStats}
              onManualDone={finish}
              onActiveChange={setActive}
              startSignal={cameraStartSignal}
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
                Finish and view summary
              </Button>
            </div>

            {/* T17/W1: hands-free control. Renders nothing in browsers
                without SpeechRecognition; unmounts (releasing the mic) when
                finishing routes to /summary. No "next" here — with one
                exercise per screen it would duplicate "finish". */}
            <VoiceControl
              commands={[
                "start",
                "pause",
                "resume",
                "finish",
                "repeat",
                "mute",
                "unmute",
              ]}
              onCommand={handleVoiceCommand}
            />
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
              : `Target ${target}° -- worth celebrating either way.`}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={onGoAgain}>
          Go again
        </Button>
        <Button asChild variant="secondary">
          <Link href={calibrateHref}>Recalibrate range</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/summary">View summary</Link>
        </Button>
      </div>
    </section>
  );
}
