"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LibraryBig } from "lucide-react";
import type { Abilities, EnergyLevel } from "@/types";
import { buildWorkout } from "@/lib/workoutBuilder";
import { localDateKey } from "@/lib/dateKey";
import { HERO_EXERCISE_ID } from "@/lib/exercises";
import { useCalibrationStore } from "@/store/calibration";
import { useHistoryStore } from "@/store/history";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";

const DEFAULT_ABILITIES: Abilities = {
  positions: ["seated", "lying"],
  equipment: ["none", "chair", "wall"],
  avoid_regions: [],
  sensory: { captions: true, reduced_motion: false, haptics: false },
};

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  1: "Rest-first",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Charged",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function TodayDashboard() {
  const router = useRouter();
  const abilities = useProfileStore((state) => state.abilities);
  const displayName = useProfileStore((state) => state.displayName);
  const todaysEnergy = useProfileStore((state) => state.todaysEnergy);
  const setTodaysEnergy = useProfileStore((state) => state.setTodaysEnergy);
  const workout = useSessionStore((state) => state.workout);
  const trackingSummary = useSessionStore((state) => state.trackingSummary);
  const setWorkout = useSessionStore((state) => state.setWorkout);
  const addCheckin = useHistoryStore((state) => state.addCheckin);
  const calibratedRange = useCalibrationStore((state) => state.ranges[HERO_EXERCISE_ID]);
  // `picked` is only this visit's explicit choice; the displayed value falls
  // through to the persisted check-in. Reading `todaysEnergy` here rather than
  // seeding useState with it matters: useState captures its initial value on
  // the first render, which runs against the pre-rehydration store so that
  // client output matches SSR. Zustand's persist applies afterwards and
  // useState never re-reads, so seeding it pinned the dial to 3 forever — and
  // then overwrote the user's real check-in with 3 on the next Create tap.
  const [picked, setPicked] = useState<EnergyLevel | null>(null);
  const energy: EnergyLevel = picked ?? todaysEnergy ?? 3;
  const [unavailable, setUnavailable] = useState(false);

  // Generation is synchronous and total now that no model sits in front of it,
  // so there is no loading state to announce and no request to fail. The one
  // real failure is a profile that leaves no exercises to draw from; the build
  // result carries it, and we say so here instead of navigating to a workout
  // with no steps (which the player would celebrate as finished).
  const createWorkout = () => {
    const result = buildWorkout({
      abilities: abilities ?? DEFAULT_ABILITIES,
      energy,
    });

    if (!result.ok) {
      setUnavailable(true);
      return;
    }

    setUnavailable(false);
    setTodaysEnergy(energy);
    addCheckin({ energy, date: localDateKey(new Date()) });
    setWorkout(result.workout);
    router.push("/workout");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-stretch">
      <header className="rise-in space-y-2 lg:col-span-2">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-raspberry">
          Adaptive Fitness
        </p>
        <h1 className="font-display text-[1.7rem] font-extrabold leading-tight text-ink sm:text-4xl lg:text-5xl">
          {displayName ? `Ready, ${displayName}` : "Ready when you are"}
        </h1>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          {DATE_FORMAT.format(new Date())}
        </p>
      </header>

      {!abilities && <OnboardingPrompt />}

      <section
        aria-labelledby="today-energy-title"
        className="rise-in rise-in-2 flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-card lg:p-8"
      >
        <div className="flex flex-1 flex-col space-y-5">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-raspberry">
              Daily check-in
            </p>
            <h2
              id="today-energy-title"
              className="font-display text-xl font-bold text-ink"
            >
              How&apos;s your energy?
            </h2>
            <div className="flex items-baseline gap-3 text-ink">
              <span className="font-display text-4xl font-extrabold leading-none">
                {energy}
              </span>
              <span className="text-lg font-bold">{ENERGY_LABELS[energy]}</span>
            </div>
          </div>

          <fieldset>
            <legend className="sr-only">Choose today&apos;s energy level</legend>
            <div className="flex items-center gap-3">
              <div className="grid flex-1 grid-cols-5 gap-2 rounded-2xl border-2 border-line-strong bg-surface p-2 shadow-inner">
                {([1, 2, 3, 4, 5] as EnergyLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={energy === level}
                    aria-label={`${level}: ${ENERGY_LABELS[level]}`}
                    onClick={() => setPicked(level)}
                    // Every segment carries its own 2px border, not just a
                    // fill: unfilled segments were bg-line on a bg-surface card
                    // at 1.31:1, so adjacent empty ones merged into a single
                    // undivided band and you could not see where one target
                    // ended and the next began (WCAG 2.2 1.4.11, needs 3:1).
                    // line-strong gives the boundary 3.97:1, raspberry 6.31:1.
                    // Border on both states keeps the box geometry identical.
                    className={`h-14 rounded-lg border-2 transition-colors ${level <= energy
                      ? "border-raspberry bg-raspberry hover:border-raspberry-deep hover:bg-raspberry-deep"
                      : "border-line-strong bg-line hover:border-raspberry hover:bg-raspberry-soft"
                      } ${energy === level ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                  />
                ))}
              </div>
              <div
                aria-hidden="true"
                className="h-7 w-1.5 rounded-full bg-line-strong"
              />
            </div>
          </fieldset>

          {/* sr-only rather than display:contents when idle — the latter has a
              history of dropping nodes out of the accessibility tree, which is
              the one thing a live region cannot afford. */}
          <p
            aria-live="polite"
            className={
              unavailable
                ? "rounded-2xl bg-raspberry-soft p-4 text-base leading-7 text-ink"
                : "sr-only"
            }
          >
            {unavailable && (
              <>
                The areas you&apos;re working around leave nothing in the library
                to draw from today. Reopen your profile and free up an area, and
                a workout can be built from what&apos;s left.{" "}
                <Link
                  href="/onboarding"
                  className="font-bold text-ink underline underline-offset-4 hover:text-raspberry"
                >
                  Adjust your profile
                </Link>
              </>
            )}
          </p>

          <button
            type="button"
            onClick={createWorkout}
            className="min-h-14 w-full rounded-full bg-ink px-6 text-lg font-bold text-milk transition-colors hover:bg-ink-hover"
          >
            Create today&apos;s workout
          </button>

          {workout && (
            <Link
              href="/exercise"
              className="flex min-h-12 items-center justify-center rounded-full border-2 border-ink px-4 text-center text-base font-bold text-ink transition-colors hover:bg-mint"
            >
              Continue tracked exercise
            </Link>
          )}
        </div>
      </section>

      <section
        aria-labelledby="movement-session-title"
        className="rise-in rise-in-3 flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-card lg:p-8"
      >
        <div className="flex flex-1 flex-col justify-between space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-evergreen">
              Hands-free counting
            </p>
            <h2
              id="movement-session-title"
              className="font-display text-xl font-bold text-ink"
            >
              Movement session
            </h2>
            <p className="text-base leading-7 text-ink-soft">
              {calibratedRange
                ? `Range saved: ${calibratedRange.minDeg}°-${calibratedRange.maxDeg}°.`
                : "Set your comfortable range before the hands-free exercise, or start with the general range."}
            </p>
          </div>

          <div className="grid gap-3">
            <DashboardActionLink href="/calibrate" label={calibratedRange ? "Recalibrate range" : "Calibrate range"} />
            <DashboardActionLink href="/exercise" label="Start tracked exercise" />
            <DashboardActionLink
              href="/summary"
              label={trackingSummary ? "View session summary" : "Summary after exercise"}
            />
          </div>
        </div>
      </section>

      <Link
        href="/library"
        // No fill change on hover. This card sits on the page, and every wash in
        // the palette is 1.00-1.15:1 against cream — a hue-only, equiluminant
        // edge that reads soft — while anything with a real luminance step is
        // a mid-saturation colour the warm-paper system deliberately does not
        // have. So the hover is carried by the edge (border 1.15:1 -> 3.47:1)
        // and the lift, matching Button, plus the icon chip inverting below.
        className="group rise-in rise-in-4 flex items-center gap-4 rounded-3xl border border-line bg-surface p-6 shadow-card transition-[border-color,transform] duration-300 ease-smooth hover:-translate-y-0.5 hover:border-line-strong active:translate-y-0 active:duration-150 lg:col-span-2 lg:p-8"
      >
        <span
          aria-hidden="true"
          // The chip inverts with the card. Every wash in the palette sits in
          // the same narrow luminance band as lavender, so tinting the card at
          // all drops this chip's edge to ~1.0:1 — an equiluminant, hue-only
          // boundary that reads as soft however different the hue is. No choice
          // of card colour fixes that; the chip has to move too. Inverted it
          // sits at 6.69:1 on mint, and the glyph keeps 6.46:1 inside it.
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lavender text-lavender-deep transition-colors group-hover:bg-lavender-deep group-hover:text-lavender"
        >
          <LibraryBig className="h-7 w-7" />
        </span>
        <span className="flex-1">
          <span className="block font-display text-xl font-bold text-ink">
            Exercise library
          </span>
          <span className="block text-base text-ink-soft">
            30+ exercises, browsable by position, equipment, body region, or
            category.
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-6 w-6 shrink-0 text-raspberry"
        />
      </Link>
    </div>
  );
}

function OnboardingPrompt() {
  return (
    <section
      aria-labelledby="onboarding-title"
      className="rise-in rise-in-2 rounded-3xl bg-raspberry-soft p-5 shadow-card lg:col-span-2 lg:p-8"
    >
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-raspberry">
          First visit
        </p>
        <h2
          id="onboarding-title"
          className="font-display text-xl font-bold text-ink"
        >
          Set up your ability profile
        </h2>
        <p className="text-base leading-7 text-ink">
          Choose positions, equipment, movement limits, and sensory preferences
          before today&apos;s workout is built.
        </p>
        <Link
          href="/onboarding"
          className="flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-base font-bold text-milk transition-colors hover:bg-ink-hover"
        >
          Start onboarding
        </Link>
      </div>
    </section>
  );
}

function DashboardActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-between rounded-2xl border-2 border-line-strong bg-surface px-4 text-base font-bold text-ink transition-colors hover:bg-mint"
    >
      <span>{label}</span>
      <ArrowRight aria-hidden="true" className="h-5 w-5 text-raspberry" />
    </Link>
  );
}