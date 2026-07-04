"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Exercise, WorkoutStep } from "@/types";
import { useSessionStore } from "@/store/session";
import { useCalibrationStore } from "@/store/calibration";
import { Timer } from "@/components/Timer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

// F9 lives entirely client-side; loaded only when someone opts in.
const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  { ssr: false },
);

/** The one exercise with hands-free rep counting (Section 5b). */
const POSE_EXERCISE_ID = "seated_lateral_raise";

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
  const [cameraOn, setCameraOn] = useState(false);

  const recalibrate = () => {
    clearRange(exercise.id);
    setCameraOn(false);
  };

  // TTS is user-triggered only (Section 6, rule 8); stop it when the step changes.
  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, [step.exercise_id]);

  const readAloud = () => {
    if (!("speechSynthesis" in window)) return;
    const text = [
      exercise.name,
      ...exercise.instructions.map((instruction) => instruction.text),
      step.adaptation_note,
    ].join(". ");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-base font-medium text-slate-600">
        Exercise {stepNumber} of {totalSteps}
      </p>
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

      <Timer seconds={step.duration_seconds} label={exercise.name} />

      {exercise.id === POSE_EXERCISE_ID && (
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
              exerciseId={exercise.id}
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
