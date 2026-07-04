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
import { Pause, Play } from "lucide-react";

// F9 lives entirely client-side; loaded only when someone opts in.
const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  { ssr: false },
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-base font-medium text-slate-600">
        Exercise {stepNumber} of {totalSteps}
      </p>
      <h1 className="text-2xl font-bold text-slate-900">{exercise.name}</h1>
      <p className="text-slate-600">{exercise.description}</p>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">How to do it</h2>
          {/* Hidden while speech is muted — nothing would play, so the corner
              mute toggle is the only relevant control then. */}
          {speechEnabled ? (
            <button
              type="button"
              onClick={toggleReadAloud}
              aria-pressed={reading}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
        <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg text-slate-900">
          {exercise.instructions.map((instruction) => (
            <li key={instruction.text}>{instruction.text}</li>
          ))}
        </ol>
      </Card>

      <p className="rounded-2xl bg-indigo-50 p-4 text-lg text-slate-900">
        {step.adaptation_note}
      </p>

      {/* When the timer runs out, advance the same way the "Done — next"
          button does (completes the step, then rest-or-next). The button
          stays available to move on early. */}
      <Timer
        seconds={step.duration_seconds}
        label={exercise.name}
        onComplete={onDone}
        onPauseChange={setTimerPaused}
      />

      {exercise.id === HERO_EXERCISE_ID && (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCameraOn((current) => !current)}
          >
            {cameraOn ? "Turn camera off" : "Count reps with camera (optional)"}
          </Button>
          {cameraOn && (
            <PoseTracker
              paused={timerPaused}
              personalRange={personalRange}
              onManualDone={onDone}
              onPeakRom={(degrees) => recordRom(exercise.id, degrees)}
            />
          )}
          <Link
            href="/calibrate"
            className="min-h-12 content-center text-center text-lg font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
          >
            {personalRange
              ? `Recalibrate range (now ${personalRange.minDeg}°–${personalRange.maxDeg}°)`
              : "Calibrate to my range for more accurate counting"}
          </Link>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <Button type="button" onClick={onDone}>
          Done — next
        </Button>
        <Button type="button" variant="secondary" onClick={onSkip}>
          Skip — no penalty
        </Button>
      </div>
    </div>
  );
}
