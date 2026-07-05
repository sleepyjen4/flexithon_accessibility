"use client";

import Link from "next/link";
import { Activity, Clock, Gauge, RotateCcw } from "lucide-react";
import { Button } from "@/components/Button";
import { getExerciseById } from "@/lib/exercises";
import { useSessionStore } from "@/store/session";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(1, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes === 0) return `${seconds} sec`;
  if (seconds === 0) return `${minutes} min`;

  return `${minutes} min ${seconds} sec`;
}

function formatDuration(startedAt: number, endedAt: number): string {
  return formatSeconds(Math.max(1, Math.round((endedAt - startedAt) / 1000)));
}

function getCelebrationLine(
  reps: number,
  consistencyPercent: number | null,
): string {
  if (reps > 0 && consistencyPercent !== null && consistencyPercent >= 85) {
    return "You showed up with steady, controlled reps in your target range.";
  }

  if (reps > 0) {
    return "You completed movement matched to today's comfortable range.";
  }

  return "You checked in with your body and made space to move today.";
}

function getRangeContext(peakAngle: number, maxDeg: number): string {
  if (peakAngle <= 0) {
    return "Camera range details were not captured. Manual completion is still a valid session.";
  }

  if (peakAngle > maxDeg) {
    return "The tracker saw movement above your calibrated range. If today feels different, recalibrate before going again.";
  }

  return "The tracker used your calibrated range to count reps. This is a target zone, not a prompt to reach farther.";
}

function getNextStepLine(
  reps: number,
  consistencyPercent: number | null,
  averageRepSeconds: number | null,
): string {
  if (reps === 0) {
    return "Try a short set when ready, or recalibrate if today feels different.";
  }

  if (consistencyPercent !== null && consistencyPercent >= 85) {
    return "This was a consistent set. Go again if your energy supports it, or let this session stand.";
  }

  if (averageRepSeconds !== null && averageRepSeconds < 2) {
    return "For the next set, try a slower pace that still feels comfortable.";
  }

  return "Keep the range comfortable. Recalibrate any time today's movement feels different.";
}

function getStatLabel(value: number | null, suffix: string): string {
  if (value === null) return "More reps to learn";

  return `${value}${suffix}`;
}

function getPaceLabel(seconds: number | null): string {
  if (seconds === null) return "More reps to learn";

  return `${seconds.toFixed(1)} sec`;
}

export default function SummaryPage() {
  const summary = useSessionStore((state) => state.trackingSummary);
  const exercise = summary ? getExerciseById(summary.exerciseId) : null;

  if (!summary) {
    return (
      <div className="flex min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <h1 className="text-3xl font-bold">No summary yet</h1>
          <p className="text-lg text-slate-600">
            Finish an exercise to see your reps and safe movement stats for
            today.
          </p>
          <Button asChild>
            <Link href="/exercise">Go again</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/calibrate">Recalibrate</Link>
          </Button>
        </div>
      </div>
    );
  }

  const rangeSpan = Math.max(
    1,
    summary.personalRange.maxDeg - summary.personalRange.minDeg,
  );
  const percentOfRange = clamp(
    ((summary.peakAngleToday - summary.personalRange.minDeg) / rangeSpan) * 100,
    0,
    100,
  );
  const peakMarker = `${percentOfRange}%`;
  const safeStats = summary.safeStats;
  const repsInTargetRange = safeStats?.repsInTargetRange ?? summary.reps;
  const consistencyPercent = safeStats?.movementConsistencyPercent ?? null;
  const averageRepSeconds = safeStats?.averageRepSeconds ?? null;
  const activeTimeLabel =
    safeStats && safeStats.activeSeconds > 0
      ? formatSeconds(safeStats.activeSeconds)
      : "Not tracked";
  const restTimeLabel = safeStats
    ? formatSeconds(safeStats.restSeconds)
    : "Not tracked";
  const durationLabel = formatDuration(summary.startedAt, summary.endedAt);
  const celebrationLine = getCelebrationLine(
    repsInTargetRange,
    consistencyPercent,
  );
  const rangeInsight = getRangeContext(
    summary.peakAngleToday,
    summary.personalRange.maxDeg,
  );
  const nextStepLine = getNextStepLine(
    repsInTargetRange,
    consistencyPercent,
    averageRepSeconds,
  );

  return (
    <div className="flex min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p
            className="text-base font-medium text-emerald-700"
            aria-live="polite"
          >
            {celebrationLine}
          </p>
          <h1 className="text-3xl font-bold">Session summary</h1>
          <p className="text-lg text-slate-600">
            {exercise?.name ?? "Exercise"} · {repsInTargetRange} target reps ·{" "}
            {durationLabel}
          </p>
        </header>

        <section
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Safe movement summary"
        >
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <RotateCcw aria-hidden="true" className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-slate-900">
                Target-range reps
              </h2>
            </div>
            <p className="mt-3 text-5xl font-bold text-slate-900">
              {repsInTargetRange}
            </p>
            <p className="mt-2 text-base text-slate-600">
              Counted inside your calibrated range.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <Gauge aria-hidden="true" className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-slate-900">
                Movement consistency
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {getStatLabel(consistencyPercent, "%")}
            </p>
            <p className="mt-2 text-base text-slate-600">
              Based on how similar counted reps were.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <Clock aria-hidden="true" className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-slate-900">
                Average rep pace
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {getPaceLabel(averageRepSeconds)}
            </p>
            <p className="mt-2 text-base text-slate-600">
              A steadier pace can support controlled movement.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <Activity aria-hidden="true" className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-slate-900">
                Active tracking time
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {activeTimeLabel}
            </p>
            <p className="mt-2 text-base text-slate-600">
              Time the camera could follow the movement.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <Clock aria-hidden="true" className="h-6 w-6" />
              <h2 className="text-lg font-semibold text-slate-900">
                Rest time
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {restTimeLabel}
            </p>
            <p className="mt-2 text-base text-slate-600">
              Time between reps, pauses, and resets count as part of a safe session.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            Comfortable range context
          </h2>
          <p className="mt-2 text-base text-slate-600">
            Your calibrated range is {summary.personalRange.minDeg}°–
            {summary.personalRange.maxDeg}°. The tracked high point was{" "}
            {summary.peakAngleToday}°, shown for context rather than as a score.
          </p>
          <p className="mt-2 text-base text-slate-600">{rangeInsight}</p>

          <div className="mt-6" aria-hidden="true">
            <div className="relative h-6 rounded-full bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-indigo-600"
                style={{ width: peakMarker }}
              />
              <div
                className="absolute top-1/2 h-12 w-1 -translate-y-1/2 rounded-full bg-slate-900"
                style={{ left: peakMarker }}
              />
            </div>
            <div className="mt-3 flex justify-between text-sm font-medium text-slate-600">
              <span>{summary.personalRange.minDeg}°</span>
              <span>{summary.personalRange.maxDeg}°</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-100">
          <h2 className="text-xl font-bold text-slate-900">Next step</h2>
          <p className="mt-2 text-lg text-slate-900">{nextStepLine}</p>
        </section>

        <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row">
          <Button asChild>
            <Link href="/exercise">Go again</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/calibrate">Recalibrate</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
