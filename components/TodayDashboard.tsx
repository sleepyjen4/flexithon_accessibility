"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LibraryBig } from "lucide-react";
import type { Abilities, EnergyLevel } from "@/types";
import { generateWorkout } from "@/lib/ai";
import { useCalibrationStore } from "@/store/calibration";
import { useHistoryStore } from "@/store/history";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";

const HERO_EXERCISE_ID = "seated_lateral_raise";

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
  const [energy, setEnergy] = useState<EnergyLevel>(todaysEnergy ?? 3);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const createWorkout = async () => {
    if (status === "loading") return;

    setStatus("loading");
    setTodaysEnergy(energy);
    addCheckin({ energy, date: new Date().toISOString().slice(0, 10) });

    try {
      const nextWorkout = await generateWorkout({
        abilities: abilities ?? DEFAULT_ABILITIES,
        energy,
        recentSessionIds: [],
      });
      setWorkout(nextWorkout);
      router.push("/workout");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
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
        className="rise-in rise-in-2 rounded-3xl border border-line bg-surface p-6 shadow-card lg:p-8"
      >
        <div className="space-y-5">
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
                    onClick={() => setEnergy(level)}
                    className={`h-14 rounded-lg transition-colors ${level <= energy
                      ? "bg-raspberry hover:bg-[#8f2a47]"
                      : "bg-line hover:bg-raspberry-soft"
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

          <p
            aria-live="polite"
            className={
              status === "idle"
                ? "sr-only"
                : "text-base font-semibold text-ink-soft"
            }
          >
            {status === "loading" && "Building a workout that fits today."}
            {status === "error" && "Something went wrong. Your check-in is saved, so try again when ready."}
          </p>

          <button
            type="button"
            onClick={createWorkout}
            disabled={status === "loading"}
            className="min-h-14 w-full rounded-full bg-ink px-6 text-lg font-bold text-milk transition-colors hover:bg-[#3a332b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Creating today's workout" : "Create today's workout"}
          </button>

          {workout && status !== "loading" && (
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
        className="rise-in rise-in-3 rounded-3xl border border-line bg-surface p-6 shadow-card lg:p-8"
      >
        <div className="space-y-4">
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
        className="rise-in rise-in-4 flex items-center gap-4 rounded-3xl border border-line bg-surface p-6 shadow-card transition-colors hover:bg-gray-100 lg:col-span-2 lg:p-8"
      >
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lavender text-[#4f4a78]"
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
          className="flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-base font-bold text-milk transition-colors hover:bg-[#3a332b]"
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
      className="flex min-h-12 items-center justify-between rounded-2xl border-2 border-line-strong bg-surface px-4 text-base font-bold text-ink transition-colors hover:bg-cream"
    >
      <span>{label}</span>
      <ArrowRight aria-hidden="true" className="h-5 w-5 text-raspberry" />
    </Link>
  );
}