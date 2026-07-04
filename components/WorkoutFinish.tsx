"use client";

import { useState } from "react";
import Link from "next/link";
import type { SessionSummary, Workout } from "@/types";
import { useSessionStore } from "@/store/session";
import { useHistoryStore } from "@/store/history";
import { saveSessionToSupabase } from "@/lib/sessions";
import { Button } from "@/components/Button";

const EFFORT_LABELS = ["Gentle", "Steady", "Working", "Strong", "Everything I had"];

interface WorkoutFinishProps {
  workout: Workout;
}

/** End-of-session screen: celebrate showing up, capture optional effort.
 * Skipped steps are a valid choice — the copy never mentions them. */
export function WorkoutFinish({ workout }: WorkoutFinishProps) {
  const completedSteps = useSessionStore((state) => state.completedSteps);
  const peakRomDegrees = useSessionStore((state) => state.peakRomDegrees);
  const savedSummary = useSessionStore((state) => state.savedSummary);
  const markSaved = useSessionStore((state) => state.markSaved);
  const addSession = useHistoryStore((state) => state.addSession);
  const [effort, setEffort] = useState<number | null>(null);

  const save = () => {
    // Guards against re-saving this same workout on a remount (browser
    // back/forward) and against a double-click racing the re-render.
    if (savedSummary) return;
    const summary: SessionSummary = {
      id: crypto.randomUUID(),
      workout_title: workout.title,
      energy_level: workout.energy_level as SessionSummary["energy_level"],
      completed_steps: completedSteps.length,
      total_steps: workout.steps.length,
      effort,
      peak_rom_degrees: peakRomDegrees,
      completed_at: new Date().toISOString(),
    };
    addSession(summary);
    void saveSessionToSupabase(workout, summary, completedSteps);
    markSaved(summary);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">You showed up today</h1>
      <p className="text-lg text-slate-600">
        That&apos;s the whole goal. {completedSteps.length} of{" "}
        {workout.steps.length} exercises done — every one of them counts.
      </p>

      {!savedSummary ? (
        <>
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="mb-2 text-lg font-semibold text-slate-900">
              How much effort did that take? (optional)
            </legend>
            {EFFORT_LABELS.map((label, index) => {
              const value = index + 1;
              const isSelected = effort === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setEffort(isSelected ? null : value)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 text-left text-lg font-medium ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50 text-slate-900"
                      : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span>
                    {value} — {label}
                  </span>
                  <span aria-hidden="true">{isSelected ? "✓" : ""}</span>
                </button>
              );
            })}
          </fieldset>
          <Button type="button" onClick={save}>
            Save today&apos;s session
          </Button>
        </>
      ) : (
        <>
          <p aria-live="polite" className="rounded-2xl bg-emerald-50 p-4 text-lg font-medium text-emerald-700">
            Saved. See you next time you feel like moving.
          </p>
          <Button asChild>
            <Link href="/progress">See my progress</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Back to home</Link>
          </Button>
        </>
      )}
    </div>
  );
}
