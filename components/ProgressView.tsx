"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useHistoryStore } from "@/store/history";
import { HERO_EXERCISE_ID } from "@/lib/exercises";
import { localDateKey } from "@/lib/dateKey";
import { Card } from "@/components/Card";

const DAY_FORMAT = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" });

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Null when the user declined to rate effort — it is optional, so we never
 * assert a tone they did not give. */
function effortTone(effort: number | null): string | null {
  if (effort === null || effort === undefined) return null;
  if (effort <= 1) return "Gentle";
  if (effort >= 3) return "Strong";
  return "Steady";
}

function modeTone(tones: string[]): string | null {
  const counts = new Map<string, number>();
  for (const tone of tones) counts.set(tone, (counts.get(tone) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [tone, count] of counts) {
    if (count > bestCount) {
      best = tone;
      bestCount = count;
    }
  }
  return best;
}

/** F6: consistency calendar + effort log. Every figure here is derived from
 * stored data — no durations, calories, steps, or streak guilt. */
export function ProgressView() {
  const sessions = useHistoryStore((state) => state.sessions);
  const checkins = useHistoryStore((state) => state.checkins);
  // Persisted stores hydrate after mount; render real data only once hydrated.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <p className="text-lg text-ink-soft">Loading your progress…</p>;
  }

  const now = new Date();
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
  const weekKeys = weekDays.map((day) => localDateKey(day));

  const sessionDateKeys = new Set(
    sessions.map((session) => localDateKey(new Date(session.completed_at))),
  );
  const checkinDateKeys = new Set(checkins.map((checkin) => checkin.date));

  const showedUpDays = weekKeys.filter(
    (key) => sessionDateKeys.has(key) || checkinDateKeys.has(key),
  ).length;

  const weekSessions = sessions.filter((session) =>
    weekKeys.includes(localDateKey(new Date(session.completed_at))),
  );
  const weekCompletedSteps = weekSessions.reduce((total, s) => total + s.completed_steps, 0);
  const weekTotalSteps = weekSessions.reduce((total, s) => total + s.total_steps, 0);

  const ratedTones = weekSessions
    .map((session) => effortTone(session.effort))
    .filter((tone): tone is string => tone !== null);
  const dominantTone = modeTone(ratedTones);

  const hasHistory = sessions.length > 0 || checkins.length > 0;
  const recentSessions = [...sessions].reverse().slice(0, 10);

  const romReadings = sessions
    .map((session) => session.peak_rom_degrees[HERO_EXERCISE_ID])
    .filter((degrees): degrees is number => typeof degrees === "number");
  const romChange =
    romReadings.length >= 2
      ? Math.round(romReadings[romReadings.length - 1] - romReadings[0])
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="text-xl font-black text-ink">This week</h2>
        {hasHistory ? (
          <p className="mt-2 text-base text-ink">
            You showed up on <strong>{showedUpDays} of the last 7 days</strong> ·{" "}
            <strong>
              {weekSessions.length} {weekSessions.length === 1 ? "session" : "sessions"}
            </strong>{" "}
            logged
            {dominantTone && (
              <>
                {" · "}
                {ratedTones.length > 1 ? "mostly " : "effort "}
                <strong>{dominantTone}</strong>
              </>
            )}
          </p>
        ) : (
          <p className="mt-2 text-base text-ink">
            Nothing logged yet. Your check-ins and finished workouts will fill in
            these marks, one per day.
          </p>
        )}

        <ul className="mt-5 grid list-none grid-cols-7 gap-2 p-0">
          {weekDays.map((day, index) => {
            const key = weekKeys[index];
            const moved = sessionDateKeys.has(key);
            const checkedIn = !moved && checkinDateKeys.has(key);
            const label = DAY_FORMAT.format(day);
            return (
              <li key={key} className="flex flex-col items-center gap-2">
                <span
                  role="img"
                  aria-label={
                    moved
                      ? `${label}: moved`
                      : checkedIn
                        ? `${label}: checked in`
                        : `${label}: nothing logged`
                  }
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors duration-300 ease-smooth ${
                    moved
                      ? "border-raspberry bg-raspberry"
                      : checkedIn
                        ? "border-raspberry bg-surface"
                        : "border-line-strong bg-surface"
                  }`}
                >
                  {checkedIn && <span className="h-3 w-3 rounded-full bg-raspberry" />}
                </span>
                <span className={`text-sm ${index === 6 ? "font-black text-ink" : "text-ink-soft"}`}>
                  {day.toLocaleDateString("en", { weekday: "short" }).slice(0, 1)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-wrap gap-4 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-raspberry" />Moved</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-raspberry bg-surface" />Checked in</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-line-strong bg-surface" />Nothing logged</span>
        </div>

        {weekSessions.length > 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            {weekCompletedSteps} of {weekTotalSteps} exercises done this week. Rest counts too.
          </p>
        )}

        {!hasHistory && (
          <Link
            href="/dashboard"
            className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-raspberry px-4 text-base font-black text-milk transition-[background-color,transform,box-shadow] duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-raspberry-deep hover:shadow-card active:translate-y-0 active:duration-150"
          >
            Check in today
          </Link>
        )}
      </Card>

      {recentSessions.length > 0 && (
        <Card>
          <h2 className="mb-4 text-xl font-black text-ink">Effort log</h2>
          <ul className="flex list-none flex-col p-0">
            {recentSessions.map((session) => {
              const tone = effortTone(session.effort);
              return (
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
                    {tone && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint px-3 py-1 text-xs font-bold text-evergreen">
                        <span className="h-2.5 w-2.5 rounded-full bg-evergreen" />
                        {tone}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {romChange !== null && romChange > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold text-ink">Range of motion</h2>
          <p className="text-lg text-raspberry">
            Your shoulder range improved {romChange}° since your first tracked set.
          </p>
        </Card>
      )}
    </div>
  );
}
