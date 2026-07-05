"use client";

import { useCallback, useEffect, useState } from "react";
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
}

export function ExerciseStep({
  step,
  exercise,
  stepNumber,
  totalSteps,
  onDone,
  onSkip,
}: ExerciseStepProps) {
  const recordRom = useSessionStore((state) => state.recordRom);
  const personalRange = useCalibrationStore(
    (state) => state.ranges[HERO_EXERCISE_ID],
  );
  const speechEnabled = useProfileStore(
    (state) => state.prefs.speech_enabled !== false,
  );
  const [cameraOn, setCameraOn] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
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

  // The hero exercise carries the optional camera (PoseTracker), a large
  // element. It lives in the wider left "read" column, directly after its own
  // toggle so revealing it on mobile never jumps the view off-screen; the short
  // sticky right column keeps the timer and Done in view while the camera
  // scrolls. Non-hero exercises use the same two columns, minus the camera.
  const isHero = exercise.id === HERO_EXERCISE_ID;

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

  const instructionsCard = (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">
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
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-strong bg-surface text-ink transition-colors hover:bg-mint"
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
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-lg leading-8 text-ink marker:font-bold marker:text-raspberry">
        {exercise.instructions.map((instruction) => (
          <li key={instruction.text}>{instruction.text}</li>
        ))}
      </ol>
    </Card>
  );

  const adaptationNote = step.adaptation_note ? (
    <div className="rounded-2xl bg-marigold-soft p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-marigold-deep">
        Adapt it
      </p>
      <p className="mt-1 text-base leading-7 text-ink">
        {step.adaptation_note}
      </p>
    </div>
  ) : null;

  // When the timer runs out, advance the same way the "Done!" button does
  // (completes the step, then rest-or-next).
  const timer = (
    <Timer
      seconds={step.duration_seconds}
      label={exercise.name}
      onComplete={onDone}
      onPauseChange={setTimerPaused}
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
            paused={timerPaused}
            personalRange={personalRange}
            onManualDone={onDone}
            onPeakRom={(degrees) => recordRom(exercise.id, degrees)}
          />
        </CameraLoadBoundary>
      )}
      <Link
        href="/calibrate"
        className="min-h-12 content-center text-center text-base font-bold text-evergreen underline underline-offset-4 hover:text-[#173f33]"
      >
        {personalRange
          ? `Recalibrate range (${personalRange.minDeg}°–${personalRange.maxDeg}°)`
          : "Calibrate my range for better counting"}
      </Link>
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
      {/* Header spans the top, full width above both columns. */}
      {header}

      {/* Read + move on the left (instructions, then the optional camera stage
          right below its toggle); session controls on the right. The right
          column is short and sticky, so the timer and Done stay in view while
          the camera scrolls — nothing gets pushed off-screen when it expands. */}
      <div className="flex flex-1 flex-col gap-5 sm:gap-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-5">
          {instructionsCard}
          {/* {adaptationNote} */}
          {cameraBlock}
        </div>
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          {timer}
          {actions}
        </div>
      </div>
    </div>
  );
}
