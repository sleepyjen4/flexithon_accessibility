"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getExerciseById } from "@/lib/exercises";
import { getStaticAudioUrl } from "@/lib/audioManifest";
import { STATIC_CLIPS } from "@/lib/staticAudio";
import { speakOrPlay } from "@/lib/speech";
import { useSessionStore } from "@/store/session";
import { ExerciseStep } from "@/components/ExerciseStep";
import { WorkoutFinish } from "@/components/WorkoutFinish";
import { Timer } from "@/components/Timer";
import { Button } from "@/components/Button";

/** F5: one exercise per screen, pause-friendly, skip is always a valid
 * choice. Fully operable with keyboard and screen reader. */
export function WorkoutPlayer() {
  const workout = useSessionStore((state) => state.workout);
  const currentStepIndex = useSessionStore((state) => state.currentStepIndex);
  const completeStep = useSessionStore((state) => state.completeStep);
  const advanceStep = useSessionStore((state) => state.advanceStep);
  const [resting, setResting] = useState(false);

  // Spoken cue on entry to rest (mirrors the on-screen copy). Prefers the
  // pre-generated Google AI Studio clip (Section 5c) so rest sounds like the
  // exercise narrator, and falls back to Web Speech when no clip exists.
  // speakOrPlay no-ops while the user has speech off, so this respects the
  // workout's speech toggle.
  useEffect(() => {
    if (resting) {
      void speakOrPlay(getStaticAudioUrl("rest"), STATIC_CLIPS.rest, {
        interrupt: true,
      });
    }
  }, [resting]);

  if (!workout) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">No workout yet</h1>
        <p className="text-lg text-slate-600">
          Check in with today&apos;s energy and we&apos;ll build one that fits.
        </p>
        <Button asChild>
          <Link href="/check-in">Check in now</Link>
        </Button>
      </div>
    );
  }

  if (currentStepIndex >= workout.steps.length) {
    return <WorkoutFinish workout={workout} />;
  }

  const step = workout.steps[currentStepIndex];
  const exercise = getExerciseById(step.exercise_id);
  const isLastStep = currentStepIndex === workout.steps.length - 1;

  const goNext = () => {
    setResting(false);
    advanceStep();
  };

  const handleDone = () => {
    completeStep(currentStepIndex);
    if (isLastStep || step.rest_after_seconds === 0) {
      goNext();
    } else {
      setResting(true);
    }
  };

  if (resting) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">Rest</h1>
        <p className="text-lg text-slate-600">
          Take your time — the next exercise waits for you.
        </p>
        {/* Keyed so each rest period gets a fresh timer instance. */}
        <Timer
          key={currentStepIndex}
          seconds={step.rest_after_seconds}
          label="Rest"
          onComplete={goNext}
        />
        <Button type="button" variant="secondary" onClick={goNext}>
          Skip rest — I&apos;m ready
        </Button>
      </div>
    );
  }

  // Seeded library and generator share ids, so this only trips on bad data;
  // recover by moving on rather than dead-ending the session.
  if (!exercise) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">
          We couldn&apos;t load this exercise
        </h1>
        <p className="text-lg text-slate-600">
          Not your fault — let&apos;s move to the next one.
        </p>
        <Button type="button" onClick={goNext}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <p aria-live="polite" className="sr-only">
        Exercise {currentStepIndex + 1} of {workout.steps.length}:{" "}
        {exercise.name}
      </p>
      <ExerciseStep
        key={currentStepIndex}
        step={step}
        exercise={exercise}
        stepNumber={currentStepIndex + 1}
        totalSteps={workout.steps.length}
        onDone={handleDone}
        onSkip={goNext}
      />
    </div>
  );
}
