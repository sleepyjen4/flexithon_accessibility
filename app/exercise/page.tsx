"use client";

import { useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { FileAudio } from "lucide-react";
import type { PersonalRange } from "@/types";
import { getPoseExerciseById } from "@/lib/pose/exercises";
import { getExerciseAudioUrl } from "@/lib/audioManifest";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";

const PoseTracker = dynamic(
  () => import("@/components/PoseTracker").then((mod) => mod.PoseTracker),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
        Loading optional camera tracker.
      </div>
    ),
  },
);

// Falls back to the first exercise only if the id ever drifts from lib/pose/exercises.ts.
const demoExercise = getPoseExerciseById("seated_arm_raise")!;

const demoRange: PersonalRange = {
  minDeg: 15,
  maxDeg: 95,
};

export default function ExercisePage() {
  const readAloud = useCallback(() => {
    const text = [demoExercise.name, ...demoExercise.instructions].join(". ");
    // Prefer the pre-generated Google AI Studio clip (Section 5c); speakOrPlay
    // falls back to the Web Speech API when no clip exists for this exercise.
    void speakOrPlay(
      getExerciseAudioUrl({ id: demoExercise.id, audio_url: null }),
      text,
      { interrupt: true },
    );
  }, []);

  // Stop any in-flight speech when leaving the page.
  useEffect(() => cancelSpeech, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Exercise tracker demo</h1>
          <p className="text-base text-slate-600">
            Follow the movement instructions. Camera tracking is optional, and
            manual completion is always available.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">{demoExercise.name}</h2>
            <button
              type="button"
              onClick={readAloud}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              aria-label={`Read aloud the instructions for ${demoExercise.name}`}
            >
              <FileAudio aria-hidden="true" />
            </button>
          </div>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700">
            {demoExercise.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        </section>

        <PoseTracker exercise={demoExercise} personalRange={demoRange} />
      </div>
    </main>
  );
}
