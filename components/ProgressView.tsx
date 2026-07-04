"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useHistoryStore } from "@/store/history";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

const POSE_EXERCISE_ID = "seated_lateral_raise";
const MONTH_FORMAT = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const DAY_FORMAT = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" });
const EFFORT_LABELS = ["Gentle", "Steady", "Working", "Strong", "Everything I had"];

/** F6: consistency calendar + effort log. Celebrates showing up —
 * never calories, steps, or streak guilt. */
export function ProgressView() {
  const sessions = useHistoryStore((state) => state.sessions);
  const checkins = useHistoryStore((state) => state.checkins);
  // Persisted stores hydrate after mount; render the empty state only once hydrated.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <p className="text-lg text-slate-600">Loading your progress…</p>;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const activeDays = new Set<number>();
  for (const session of sessions) {
    const date = new Date(session.completed_at);
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
      activeDays.add(date.getDate());
    }
  }
  for (const checkin of checkins) {
    const date = new Date(`${checkin.date}T00:00:00`);
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
      activeDays.add(date.getDate());
    }
  }

  const romReadings = sessions
    .map((session) => session.peak_rom_degrees[POSE_EXERCISE_ID])
    .filter((degrees): degrees is number => typeof degrees === "number");
  const romChange =
    romReadings.length >= 2
      ? Math.round(romReadings[romReadings.length - 1] - romReadings[0])
      : null;

  if (sessions.length === 0 && checkins.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-lg text-slate-600">
          Nothing here yet — and that&apos;s fine. Whenever you&apos;re ready,
          check in and we&apos;ll take it from there.
        </p>
        <Button asChild>
          <Link href="/check-in">Check in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {MONTH_FORMAT.format(now)} — days you showed up
        </h2>
        <ul className="grid list-none grid-cols-7 gap-2 p-0">
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const active = activeDays.has(day);
            const dayLabel = DAY_FORMAT.format(new Date(now.getFullYear(), now.getMonth(), day));
            return (
              <li
                key={day}
                aria-label={active ? `${dayLabel}: showed up` : dayLabel}
                className={`flex aspect-square items-center justify-center rounded-lg text-base font-medium ${
                  active
                    ? "bg-indigo-600 font-bold text-white"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                {active ? <span aria-hidden="true">{day}✓</span> : day}
              </li>
            );
          })}
        </ul>
      </Card>

      {romChange !== null && romChange > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Range of motion</h2>
          <p className="text-lg text-emerald-700">
            Your shoulder range improved {romChange}° since your first tracked set.
          </p>
        </Card>
      )}

      {sessions.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Effort log</h2>
          <ul className="flex list-none flex-col gap-4 p-0">
            {[...sessions].reverse().slice(0, 10).map((session) => (
              <li key={session.id} className="flex flex-col gap-1 border-b border-slate-200 pb-3 last:border-b-0">
                <span className="text-lg font-semibold text-slate-900">
                  {session.workout_title}
                </span>
                <span className="text-base text-slate-600">
                  {DAY_FORMAT.format(new Date(session.completed_at))} ·{" "}
                  {session.completed_steps} of {session.total_steps} exercises
                  {session.effort
                    ? ` · effort: ${EFFORT_LABELS[session.effort - 1]}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
