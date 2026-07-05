"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useHistoryStore } from "@/store/history";
import { HERO_EXERCISE_ID } from "@/lib/exercises";
import { Card } from "@/components/Card";
import type { WorkoutSessionSummary } from "@/types";

const DAY_FORMAT = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" });
const SHORT_DAY_FORMAT = new Intl.DateTimeFormat("en", { month: "numeric", day: "numeric" });

type ProgressLogSession = Pick<
  WorkoutSessionSummary,
  "id" | "workout_title" | "completed_steps" | "total_steps" | "effort" | "completed_at"
>;

const DEMO_SESSIONS: ProgressLogSession[] = [
  {
    id: "demo-jul-4",
    workout_title: "Gentle Seated Strength",
    completed_steps: 4,
    total_steps: 4,
    effort: 2,
    completed_at: "2026-07-04T10:00:00.000Z",
  },
  {
    id: "demo-jul-3",
    workout_title: "Chair Mobility Flow",
    completed_steps: 3,
    total_steps: 3,
    effort: 1,
    completed_at: "2026-07-03T10:00:00.000Z",
  },
  {
    id: "demo-jul-1",
    workout_title: "Upper-Body Band Work",
    completed_steps: 5,
    total_steps: 5,
    effort: 3,
    completed_at: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "demo-jun-30",
    workout_title: "Gentle Seated Strength",
    completed_steps: 4,
    total_steps: 5,
    effort: 2,
    completed_at: "2026-06-30T10:00:00.000Z",
  },
];

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function effortTone(effort: number | null): string {
  if (!effort || effort <= 1) return "Gentle";
  if (effort >= 3) return "Strong";
  return "Steady";
}

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
    return <p className="text-lg text-ink-soft">Loading your progress…</p>;
  }

  const now = new Date();
  const activeDateKeys = new Set<string>();
  for (const session of sessions) {
    const date = new Date(session.completed_at);
    activeDateKeys.add(getDateKey(date));
  }
  for (const checkin of checkins) {
    activeDateKeys.add(checkin.date);
  }

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
  const weekActiveDays = weekDays.filter((day) => activeDateKeys.has(getDateKey(day))).length;
  const hasHistory = sessions.length > 0 || checkins.length > 0;
  const displaySessions = sessions.length > 0 ? [...sessions].reverse().slice(0, 10) : DEMO_SESSIONS;
  const weekMinutes = sessions.reduce((total, session) => total + session.total_steps * 4, 0);
  const displayDays = hasHistory ? weekActiveDays : 5;
  const displayMinutes = hasHistory ? Math.max(weekMinutes, sessions.length * 12) : 81;

  const romReadings = sessions
    .map((session) => session.peak_rom_degrees[HERO_EXERCISE_ID])
    .filter((degrees): degrees is number => typeof degrees === "number");
  const romChange =
    romReadings.length >= 2
      ? Math.round(romReadings[romReadings.length - 1] - romReadings[0])
      : null;

  if (!hasHistory) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
          <p className="text-lg text-ink-soft">
            Nothing saved yet. The preview below shows how sessions will appear
            after check-ins and workouts.
          </p>
          <Link
            href="/"
            className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-evergreen px-4 text-base font-black text-milk hover:bg-[#173f33]"
          >
            Check in today
          </Link>
        </Card>
        <ProgressCards
          activeDateKeys={new Set(["preview"])}
          displayDays={displayDays}
          displayMinutes={displayMinutes}
          displaySessions={displaySessions}
          now={now}
          preview
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressCards
        activeDateKeys={activeDateKeys}
        displayDays={displayDays}
        displayMinutes={displayMinutes}
        displaySessions={displaySessions}
        now={now}
      />

      {romChange !== null && romChange > 0 && (
        <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
          <h2 className="mb-2 text-lg font-semibold text-ink">Range of motion</h2>
          <p className="text-lg text-evergreen">
            Your shoulder range improved {romChange}° since your first tracked set.
          </p>
        </Card>
      )}
    </div>
  );
}

function ProgressCards({
  activeDateKeys,
  displayDays,
  displayMinutes,
  displaySessions,
  now,
  preview = false,
}: {
  activeDateKeys: Set<string>;
  displayDays: number;
  displayMinutes: number;
  displaySessions: ProgressLogSession[];
  now: Date;
  preview?: boolean;
}) {
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
  const chartDays = weekDays.filter((_, index) => index % 2 === 0 || index === 5);

  return (
    <>
      <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1 text-center text-[13px] font-black leading-none text-ink sm:text-sm md:text-base">
          <span className="flex min-h-12 min-w-0 items-center justify-center rounded-lg bg-evergreen px-2 text-milk">
            <span className="whitespace-nowrap">This week</span>
          </span>
          <span className="flex min-h-12 min-w-0 items-center justify-center px-2">
            <span className="whitespace-nowrap">This month</span>
          </span>
        </div>
        <p className="text-base text-ink">
          You moved on <strong>{displayDays} days</strong> · <strong>{displayMinutes} min</strong> · mostly
          <strong> Steady</strong>
        </p>
        <div className="mt-6 flex h-24 items-end justify-between border-b border-line pb-3" aria-hidden="true">
          {chartDays.map((day, index) => {
            const active = preview || activeDateKeys.has(getDateKey(day));
            const heights = [76, 58, 76, 42, 52];
            return (
              <div key={day.toISOString()} className="flex flex-col items-center gap-2">
                <span
                  className={`w-9 rounded-t-lg ${active ? "bg-evergreen" : "bg-line-strong"}`}
                  style={{ height: `${heights[index]}px`, opacity: active ? 0.9 : 0.7 }}
                />
                <span className="text-xs text-ink-soft">{SHORT_DAY_FORMAT.format(day)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Each mark is a session — every one counts the same.
        </p>
      </Card>

      <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <h2 className="text-xl font-black text-ink">Recent days</h2>
        <p className="mt-1 text-base text-ink-soft">
          {displayDays} of the last 7 days. Rest counts too.
        </p>
        <ul className="mt-5 grid list-none grid-cols-7 gap-2 p-0">
          {weekDays.map((day, index) => {
            const active = preview ? index !== 1 : activeDateKeys.has(getDateKey(day));
            const checkedIn = !active && index === 4;
            const label = DAY_FORMAT.format(day);
            return (
              <li key={day.toISOString()} className="flex flex-col items-center gap-2">
                <span
                  aria-label={
                    active
                      ? `${label}: moved`
                      : checkedIn
                        ? `${label}: checked in`
                        : `${label}: rest`
                  }
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                    active
                      ? "border-evergreen bg-evergreen"
                      : checkedIn
                        ? "border-evergreen bg-surface"
                        : "border-line-strong bg-surface"
                  }`}
                >
                  {checkedIn && <span className="h-3 w-3 rounded-full bg-evergreen" />}
                </span>
                <span className={`text-sm ${index === 6 ? "font-black text-ink" : "text-ink-soft"}`}>
                  {day.toLocaleDateString("en", { weekday: "short" }).slice(0, 1)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-wrap gap-4 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-evergreen" />Moved</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-evergreen bg-surface" />Checked in</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-line-strong bg-surface" />Rest</span>
        </div>
      </Card>

      <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <h2 className="mb-4 text-xl font-black text-ink">Effort log</h2>
        <ul className="flex list-none flex-col p-0">
          {displaySessions.map((session) => (
            <li key={session.id} className="border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-lg font-black leading-snug text-ink">
                    {session.workout_title}
                  </span>
                  <span className="mt-1 block text-base text-ink-soft">
                    {DAY_FORMAT.format(new Date(session.completed_at))} · {session.completed_steps} of {session.total_steps} exercises
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint px-3 py-1 text-xs font-bold text-evergreen">
                  <span className="h-2.5 w-2.5 rounded-full bg-evergreen" />
                  {effortTone(session.effort)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
