"use client";

import Link from "next/link";
import { Activity, CheckCircle2, Clock, Gauge, Home, RotateCcw } from "lucide-react";
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
      <div className="flex min-h-screen bg-cream px-4 py-6 text-ink">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <h1 className="font-display text-3xl font-extrabold">
            No summary yet
          </h1>
          <p className="text-lg text-ink-soft">
            Finish an exercise to see your reps and safe movement stats for
            today.
          </p>
          <Button asChild>
            <Link href="/exercise">Go again</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/calibrate">Recalibrate</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard" aria-label="Return to dashboard" className="gap-2">
              <Home aria-hidden="true" className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
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
    <div className="flex min-h-screen bg-cream px-4 py-6 text-ink sm:px-6 lg:py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rise-in space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-raspberry">
            Session summary
          </p>
          <h1
            aria-live="polite"
            className="font-display text-3xl font-extrabold sm:text-4xl"
          >
            {celebrationLine}
          </h1>
          <p className="text-lg text-ink-soft">
            {exercise?.name ?? "Exercise"} · {repsInTargetRange} target reps ·{" "}
            {durationLabel}
          </p>
        </header>

        <section
          className="rise-in rise-in-2 grid gap-4 sm:grid-cols-2"
          aria-label="Safe movement summary"
        >
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:col-span-2">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-evergreen"
              >
                <RotateCcw className="h-6 w-6" />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Target-range reps
              </h2>
            </div>
            <p className="mt-3 font-display text-6xl font-extrabold tabular-nums text-ink">
              {repsInTargetRange}
            </p>
            <p className="mt-2 text-base text-ink-soft">
              Counted inside your calibrated range.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lavender text-[#4f4a78]"
              >
                <Gauge className="h-6 w-6" />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Movement consistency
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink">
              {getStatLabel(consistencyPercent, "%")}
            </p>
            <p className="mt-2 text-base text-ink-soft">
              Based on how similar counted reps were.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-marigold-soft text-marigold-deep"
              >
                <Clock className="h-6 w-6" />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Average rep pace
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink">
              {getPaceLabel(averageRepSeconds)}
            </p>
            <p className="mt-2 text-base text-ink-soft">
              A steadier pace can support controlled movement.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-evergreen"
              >
                <Activity className="h-6 w-6" />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Active tracking time
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink">
              {activeTimeLabel}
            </p>
            <p className="mt-2 text-base text-ink-soft">
              Time the camera could follow the movement.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-raspberry-soft text-raspberry"
              >
                <Clock className="h-6 w-6" />
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                Rest time
              </h2>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink">
              {restTimeLabel}
            </p>
            <p className="mt-2 text-base text-ink-soft">
              Time between reps, pauses, and resets count as part of a safe
              session.
            </p>
          </div>
        </section>

        <section className="rise-in rise-in-3 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-xl font-bold text-ink">
            Comfortable range context
          </h2>
          <p className="mt-2 text-base text-ink-soft">
            Your calibrated range is {summary.personalRange.minDeg}°–
            {summary.personalRange.maxDeg}°. The tracked high point was{" "}
            {summary.peakAngleToday}°, shown for context rather than as a score.
          </p>
          <p className="mt-2 text-base text-ink-soft">{rangeInsight}</p>

          <div className="mt-6" aria-hidden="true">
            <div className="relative h-6 rounded-full bg-cream">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-raspberry"
                style={{ width: peakMarker }}
              />
              <div
                className="absolute top-1/2 h-12 w-1 -translate-y-1/2 rounded-full bg-ink"
                style={{ left: peakMarker }}
              />
            </div>
            <div className="mt-3 flex justify-between text-sm font-medium text-ink-soft">
              <span>{summary.personalRange.minDeg}°</span>
              <span>{summary.personalRange.maxDeg}°</span>
            </div>
          </div>
        </section>

        <section className="rise-in rise-in-4 rounded-3xl bg-mint p-5">
          <h2 className="font-display text-xl font-bold text-evergreen">
            Next step
          </h2>
          <p className="mt-2 text-lg text-ink">{nextStepLine}</p>
        </section>

        <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard" aria-label="Finish and return to dashboard" className="gap-2">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
              <span>Finish</span>
            </Link>
          </Button>
          <Button asChild variant="secondary">
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
