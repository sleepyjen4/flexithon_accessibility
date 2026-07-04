"use client";

import dynamic from "next/dynamic";
import type { ExerciseDef, PersonalRange } from "@/types";

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

const demoExercise: ExerciseDef = {
  id: "seated_arm_raise",
  name: "Seated lateral raise",
  landmarks: [13, 11, 23],
  side: "either",
  instructions: [
    "Sit in a supported position.",
    "Raise one arm out to the side toward a comfortable range.",
    "Lower your arm gently when you are ready.",
  ],
  cues: {
    rangeReached: "You reached your target range.",
    encourage: [
      "Move within today’s comfortable range.",
      "Pause whenever you need.",
    ],
  },
};

const demoRange: PersonalRange = {
  minDeg: 15,
  maxDeg: 95,
};

export default function ExercisePage() {
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
          <h2 className="text-2xl font-bold">{demoExercise.name}</h2>
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
