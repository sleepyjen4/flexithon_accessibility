"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { VoiceCommand } from "@/types";
import { getExerciseById } from "@/lib/exercises";
import { getStaticAudioUrl } from "@/lib/audioManifest";
import { STATIC_CLIPS } from "@/lib/staticAudio";
import { speakOrPlay } from "@/lib/speech";
import { setSpeechEnabled } from "@/lib/prefs";
import { useSessionStore } from "@/store/session";
import { ExerciseStep } from "@/components/ExerciseStep";
import { WorkoutFinish } from "@/components/WorkoutFinish";
import { Timer } from "@/components/Timer";
import { Button } from "@/components/Button";
import { VoiceControl } from "@/components/VoiceControl";
import { SpeechToggle } from "@/components/SpeechToggle";

/** F5: one exercise per screen, pause-friendly, skip is always a valid
 * choice. Fully operable with keyboard and screen reader. */
export function WorkoutPlayer() {
  const workout = useSessionStore((state) => state.workout);
  const currentStepIndex = useSessionStore((state) => state.currentStepIndex);
  const completeStep = useSessionStore((state) => state.completeStep);
  const advanceStep = useSessionStore((state) => state.advanceStep);
  const [resting, setResting] = useState(false);
  // Timer pause lives here (not in the Timer/ExerciseStep) so the "pause" and
  // "resume" voice commands (F8) can drive whichever timer is on screen; the
  // extend signal does the same for the "add time" command (+30 seconds).
  const [timerPaused, setTimerPaused] = useState(false);
  const [extendSignal, setExtendSignal] = useState(0);
  const [repeatSignal, setRepeatSignal] = useState(0);
  // Voice-driven pause/resume announcements; button-driven ones come from the
  // Timer itself, so this only speaks for actions with no button press.
  const [voiceMessage, setVoiceMessage] = useState("");

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
        <h1 className="font-display text-2xl font-bold text-ink">
          No workout yet
        </h1>
        <p className="text-lg text-ink-soft">
          Check in with today&apos;s energy and we&apos;ll build one that fits.
        </p>
        <Button asChild>
          <Link href="/">Check in now</Link>
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
    setTimerPaused(false);
    advanceStep();
  };

  const handleDone = () => {
    completeStep(currentStepIndex);
    setTimerPaused(false);
    if (isLastStep || step.rest_after_seconds === 0) {
      goNext();
    } else {
      setResting(true);
    }
  };

  // F8: the voice grammar, routed by context. "next" completes the step (or
  // skips the rest); "skip" moves on without completing — a valid choice.
  const handleVoiceCommand = (command: VoiceCommand) => {
    switch (command) {
      case "pause":
        if (!timerPaused) {
          setTimerPaused(true);
          setVoiceMessage("Paused.");
        }
        break;
      case "resume":
        if (timerPaused) {
          setTimerPaused(false);
          setVoiceMessage("Resumed.");
        }
        break;
      case "next":
        setVoiceMessage("");
        if (resting || !exercise) goNext();
        else handleDone();
        break;
      case "skip":
        setVoiceMessage("");
        goNext();
        break;
      case "extend":
        // The on-screen timer announces "Added 30 seconds." itself.
        setVoiceMessage("");
        setExtendSignal((signal) => signal + 1);
        break;
      case "repeat":
        setVoiceMessage("");
        if (resting) {
          // Replay the rest cue; during a step the ExerciseStep replays its
          // instructions off the signal below.
          void speakOrPlay(getStaticAudioUrl("rest"), STATIC_CLIPS.rest, {
            interrupt: true,
          });
        } else {
          setRepeatSignal((signal) => signal + 1);
        }
        break;
      case "mute":
        setSpeechEnabled(false);
        setVoiceMessage("Spoken instructions off.");
        break;
      case "unmute":
        setSpeechEnabled(true);
        setVoiceMessage("Spoken instructions on.");
        break;
    }
  };

  let content: ReactNode;

  if (resting) {
    content = (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8">
        <h1 className="font-display text-2xl font-bold text-ink">Rest</h1>
        <p className="text-lg text-ink-soft">
          Take your time, the next exercise waits for you.
        </p>
        {/* Keyed so each rest period gets a fresh timer instance. The rest
            countdown uses the circular ring UI. */}
        <Timer
          key={currentStepIndex}
          seconds={step.rest_after_seconds}
          label="Rest"
          onComplete={goNext}
          paused={timerPaused}
          onPauseChange={setTimerPaused}
          extendSignal={extendSignal}
          variant="ring"
        />
        <Button type="button" variant="success" onClick={goNext}>
          Skip Rest
        </Button>
      </div>
    );
  } else if (!exercise) {
    // Seeded library and generator share ids, so this only trips on bad data;
    // recover by moving on rather than dead-ending the session.
    content = (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          We couldn&apos;t load this exercise
        </h1>
        <p className="text-lg text-ink-soft">
          Not your fault — let&apos;s move to the next one.
        </p>
        <Button type="button" onClick={goNext}>
          Continue
        </Button>
      </div>
    );
  } else {
    content = (
      <>
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
          paused={timerPaused}
          onPauseChange={setTimerPaused}
          extendSignal={extendSignal}
          repeatSignal={repeatSignal}
        />
      </>
    );
  }

  // The control row (voice mic + mute) and VoiceControl sit OUTSIDE the
  // switching content, in a stable tree position, so the mic never remounts
  // between exercise and rest — a remount would release the mic and silently
  // end hands-free control mid-workout.
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-4xl">
      <div className="mb-6 flex items-center justify-end gap-2">
        <VoiceControl
          commands={[
            "pause",
            "resume",
            "next",
            "skip",
            "repeat",
            "extend",
            "mute",
            "unmute",
          ]}
          onCommand={handleVoiceCommand}
        />
        <SpeechToggle />
      </div>
      {content}
      <p aria-live="polite" className="sr-only">
        {voiceMessage}
      </p>
    </div>
  );
}
