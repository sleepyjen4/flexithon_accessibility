"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Exercise, WorkoutStep } from "@/types";
import { useSessionStore } from "@/store/session";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";
import { useCalibrationStore } from "@/store/calibration";
import { useProfileStore } from "@/store/profile";
import { HERO_EXERCISE_ID } from "@/lib/exercises";
import { getExerciseAudioUrl } from "@/lib/audioManifest";
import { Timer } from "@/components/Timer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CameraLoadBoundary } from "@/components/CameraLoadBoundary";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { getExerciseVideoUrl } from "@/lib/exerciseVideos";
import { Pause, Play } from "lucide-react";

// F9 lives entirely client-side; loaded only when someone opts in.
const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border-2 border-line-strong bg-surface p-4 text-base text-ink-soft">
        Loading the camera…
      </div>
    ),
  },
);

interface ExerciseStepProps {
  step: WorkoutStep;
  exercise: Exercise;
  stepNumber: number;
  totalSteps: number;
  onDone: () => void;
  onSkip: () => void;
  /** Timer pause lives in the player (F8) so voice commands can drive it; the
   * Timer's own Pause button reports back through onPauseChange. */
  paused: boolean;
  onPauseChange: (paused: boolean) => void;
  /** Passed through to the step timer (the "add time" voice command). */
  extendSignal: number;
  /** Increment to replay the instructions (the "repeat" voice command). */
  repeatSignal: number;
}

export function ExerciseStep({
  step,
  exercise,
  stepNumber,
  totalSteps,
  onDone,
  onSkip,
  paused,
  onPauseChange,
  extendSignal,
  repeatSignal,
}: ExerciseStepProps) {
  const recordRom = useSessionStore((state) => state.recordRom);
  const personalRange = useCalibrationStore(
    (state) => state.ranges[HERO_EXERCISE_ID],
  );
  const speechEnabled = useProfileStore(
    (state) => state.prefs.speech_enabled !== false,
  );
  const [cameraOn, setCameraOn] = useState(false);
  const [reading, setReading] = useState(false);

  const playInstructions = useCallback(() => {
    const text = [
      exercise.name,
      ...exercise.instructions.map((instruction) => instruction.text),
      step.adaptation_note,
    ].join(". ");
    // Prefer a pre-generated Google AI Studio clip (Section 5c); speakOrPlay falls
    // back to the Web Speech API (with the full text incl. note) when none.
    // Resolves when it ends, is stopped, or no-ops (muted) — reset either way.
    setReading(true);
    void speakOrPlay(getExerciseAudioUrl(exercise), text, {
      interrupt: true,
    }).finally(() => setReading(false));
  }, [exercise, step.adaptation_note]);

  // Play/stop toggle for the button: a second tap stops the clip mid-way.
  const toggleReadAloud = useCallback(() => {
    if (reading) {
      cancelSpeech();
      setReading(false);
      return;
    }
    playInstructions();
  }, [reading, playInstructions]);

  // Autoplay the instructions when each step opens. Deferred a tick so the
  // play/stop state update lands outside the effect body; speakOrPlay no-ops
  // while the user has speech turned off, so the corner toggle governs autoplay
  // too. Speech is cancelled when the step changes or unmounts.
  useEffect(() => {
    const timer = setTimeout(playInstructions, 0);
    return () => {
      clearTimeout(timer);
      cancelSpeech();
    };
  }, [playInstructions]);

  // Voice-driven "repeat": replay the instructions from the start. Initialized
  // to the mounting value so a new step ignores signals from earlier steps;
  // deferred a tick so the play-state update lands outside the effect body.
  const handledRepeatSignalRef = useRef(repeatSignal);
  useEffect(() => {
    if (repeatSignal === handledRepeatSignalRef.current) return;
    handledRepeatSignalRef.current = repeatSignal;
    const timer = setTimeout(playInstructions, 0);
    return () => clearTimeout(timer);
  }, [repeatSignal, playInstructions]);

  // The hero exercise carries the optional camera (PoseTracker), a large
  // element. It lives in the wider left "read" column, directly after its own
  // toggle so revealing it on mobile never jumps the view off-screen; the short
  // sticky right column keeps the timer and Done in view while the camera
  // scrolls. Non-hero exercises use the same two columns, minus the camera.
  const isHero = exercise.id === HERO_EXERCISE_ID;

  const demoUrl = getExerciseVideoUrl(exercise.id);
  const demo = demoUrl ? (
    <ExerciseDemo videoUrl={demoUrl} name={exercise.name} />
  ) : null;

  const header = (
    <div className="flex flex-col gap-2">
      {totalSteps > 1 && (
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-raspberry">
          Exercise {stepNumber} of {totalSteps}
        </p>
      )}
      <h1 className="font-display text-3xl font-extrabold leading-tight text-ink">
        {exercise.name}
      </h1>
      <p className="text-base leading-7 text-ink-soft">
        {exercise.description}
      </p>
    </div>
  );

  // Marigold border matches the standalone /exercise tracker screen's "How to
  // move" card, so the two hands-free-counting surfaces read as one design.
  const instructionsCard = (
    <section className="rounded-3xl border-2 border-marigold bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          How to do it
        </h2>
        {/* Hidden while speech is muted — nothing would play, so the corner
            mute toggle is the only relevant control then. */}
        {speechEnabled ? (
          <button
            type="button"
            suppressHydrationWarning
            onClick={toggleReadAloud}
            aria-pressed={reading}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink transition-colors hover:bg-mint"
            aria-label={
              reading
                ? "Stop reading the instructions"
                : "Play the instructions from the start"
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
        {exercise.instructions.map((instruction, index) => (
          <li key={instruction.text} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marigold-soft text-base font-bold text-marigold-deep"
            >
              {index + 1}
            </span>
            <span className="text-lg leading-7">{instruction.text}</span>
          </li>
        ))}
      </ol>
      {step.adaptation_note ? (
        <div className="mt-4 rounded-2xl bg-marigold-soft p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-marigold-deep">
            Adapt it
          </p>
          <p className="mt-1 text-base leading-7 text-ink">
            {step.adaptation_note}
          </p>
        </div>
      ) : null}
    </section>
  );

  // When the timer runs out, advance the same way the "Done!" button does
  // (completes the step, then rest-or-next).
  const timer = (
    <Timer
      seconds={step.duration_seconds}
      label={exercise.name}
      onComplete={onDone}
      paused={paused}
      onPauseChange={onPauseChange}
      extendSignal={extendSignal}
    />
  );

  const cameraBlock = isHero ? (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setCameraOn((current) => !current)}
      >
        {cameraOn ? "Turn camera off" : "Count reps with camera"}
      </Button>
      {cameraOn && (
        <CameraLoadBoundary
          fallback={
            <div className="rounded-2xl border-2 border-line-strong bg-surface p-4 text-base text-ink-soft">
              The camera add-on couldn&apos;t load. You can keep going and tap
              &ldquo;Done!&rdquo; as you finish each set.
            </div>
          }
        >
          <PoseTracker
            paused={paused}
            personalRange={personalRange}
            onManualDone={onDone}
            onPeakRom={(degrees) => recordRom(exercise.id, degrees)}
          />
        </CameraLoadBoundary>
      )}
      {personalRange ? (
        <div className="rounded-3xl border border-line bg-surface p-5 text-ink-soft shadow-card">
          Counting against your calibrated range:{" "}
          <span className="font-semibold text-ink">
            {personalRange.minDeg}°-{personalRange.maxDeg}°
          </span>
          .{" "}
          <Link
            href="/calibrate"
            className="font-semibold text-ink underline underline-offset-4 hover:text-raspberry"
          >
            Recalibrate
          </Link>
        </div>
      ) : (
        <div className="rounded-3xl bg-lavender p-5">
          <h2 className="font-display text-lg font-bold text-ink">
            Counting to a general range
          </h2>
          <p className="mt-1 text-base text-ink">
            For counting tuned to how you move today, calibrate first. You can
            also carry on with a general range right now.
          </p>
          <Link
            href="/calibrate"
            className="mt-2 inline-flex min-h-12 items-center font-semibold text-ink underline underline-offset-4 hover:text-raspberry"
          >
            Calibrate my range
          </Link>
        </div>
      )}
    </div>
  ) : null;

  const actions = (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={onDone}>
        Done!
      </Button>
      <Button type="button" variant="secondary" onClick={onSkip}>
        Skip this exercise
      </Button>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      {/* Header and instructions span the top, full width above the demo and
          camera columns, so how-to-move info is read before anything else. */}
      {header}
      {instructionsCard}

      {isHero ? (
        // Hero exercise only: demo + timer + actions on the left, the optional
        // camera tracker sticky on the right.
        <div className="flex flex-1 flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-5">
            {demo}
            <Card>{timer}</Card>
            {actions}
          </div>
          <div className="flex flex-col gap-5 lg:sticky lg:top-6">
            {cameraBlock}
          </div>
        </div>
      ) : (
        // No camera to balance a second column, so demo and timer sit
        // side by side instead of stacking into one tall, narrow strip.
        <div className="flex flex-1 flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-5">{demo}</div>
          <div className="flex flex-col gap-5">
            <Card>{timer}</Card>
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}
