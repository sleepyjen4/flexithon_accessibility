"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Volume2, VolumeX } from "lucide-react";
import type { Exercise, WorkoutStep } from "@/types";
import { useSessionStore } from "@/store/session";
import { cancelSpeech, speak } from "@/lib/speech";
import { useCalibrationStore } from "@/store/calibration";
import { useProfileStore } from "@/store/profile";
import { savePrefsToSupabase } from "@/lib/prefs";
import { HERO_EXERCISE_ID } from "@/lib/exercises";
import { Timer } from "@/components/Timer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

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
  const hasCalibration = useCalibrationStore((state) => Boolean(state.ranges[exercise.id]));
  const clearRange = useCalibrationStore((state) => state.clearRange);
  const prefs = useProfileStore((state) => state.prefs);
  const setPrefs = useProfileStore((state) => state.setPrefs);
  const [cameraOn, setCameraOn] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const speechEnabled = prefs.speech_enabled !== false;

  const recalibrate = () => {
    clearRange(exercise.id);
    setCameraOn(false);
  };

  const toggleSpeech = () => {
    const next = { ...prefs, speech_enabled: !speechEnabled };
    setPrefs(next);
    void savePrefsToSupabase(next);
  };

  const readAloud = useCallback(() => {
    const text = [
      exercise.name,
      ...exercise.instructions.map((instruction) => instruction.text),
      step.adaptation_note,
    ].join(". ");
    void speak(text, { interrupt: true });
  }, [exercise.name, exercise.instructions, step.adaptation_note]);

  // Autoplay the instructions when each step opens. speak() no-ops while the
  // user has speech turned off, so the corner toggle governs autoplay too;
  // speech is cancelled when the step changes or unmounts.
  useEffect(() => {
    readAloud();
    return () => cancelSpeech();
  }, [readAloud]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-medium text-slate-600">
          Exercise {stepNumber} of {totalSteps}
        </p>
        <button
          type="button"
          onClick={toggleSpeech}
          aria-pressed={speechEnabled}
          aria-label={
            speechEnabled ? "Turn spoken instructions off" : "Turn spoken instructions on"
          }
          className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {speechEnabled ? (
            <Volume2 aria-hidden="true" className="h-6 w-6" />
          ) : (
            <VolumeX aria-hidden="true" className="h-6 w-6" />
          )}
        </button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{exercise.name}</h1>
      <p className="text-slate-600">{exercise.description}</p>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">How to do it</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg text-slate-900">
          {exercise.instructions.map((instruction) => (
            <li key={instruction.text}>{instruction.text}</li>
          ))}
        </ol>
      </Card>

      <p className="rounded-2xl bg-indigo-50 p-4 text-lg text-slate-900">
        {step.adaptation_note}
      </p>

      <Timer
        seconds={step.duration_seconds}
        label={exercise.name}
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
          {cameraOn && hasCalibration && (
            <Button type="button" variant="secondary" onClick={recalibrate}>
              Recalibrate my range
            </Button>
          )}
          {cameraOn && (
            <PoseTracker
              paused={timerPaused}
              onManualDone={onDone}
              onPeakRom={(degrees) => recordRom(exercise.id, degrees)}
            />
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <Button type="button" onClick={onDone}>
          Done — next
        </Button>
        <Button type="button" variant="secondary" onClick={onSkip}>
          Skip — no penalty
        </Button>
        <Button type="button" variant="secondary" onClick={readAloud}>
          Read instructions aloud
        </Button>
      </div>
    </div>
  );
}
