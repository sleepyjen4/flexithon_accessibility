"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
      <header className="space-y-2 lg:col-span-2">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#41637f]">
          Adaptive Fitness
        </p>
        <h1 className="text-[1.55rem] font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
          {displayName ? `Ready, ${displayName}` : "Ready when you are"}
        </h1>
        <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
          {DATE_FORMAT.format(new Date())}
        </p>
      </header>

      {!abilities && <OnboardingPrompt />}

      <section
        aria-labelledby="today-energy-title"
        className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-[0_18px_38px_rgba(15,23,42,0.08)] lg:p-8"
      >
        <div className="space-y-5">
          <div className="space-y-4">
            <h2 id="today-energy-title" className="text-xl font-black text-slate-950">
              How&apos;s your energy?
            </h2>
            <div className="flex items-baseline gap-3 text-slate-950">
              <span className="text-4xl font-black leading-none">{energy}</span>
              <span className="text-lg font-black">{ENERGY_LABELS[energy]}</span>
            </div>
          </div>

          <fieldset>
            <legend className="sr-only">Choose today&apos;s energy level</legend>
            <div className="flex items-center gap-3">
              <div className="grid flex-1 grid-cols-5 gap-2 rounded-2xl border-2 border-slate-300 bg-white p-2 shadow-inner">
                {([1, 2, 3, 4, 5] as EnergyLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={energy === level}
                    aria-label={`${level}: ${ENERGY_LABELS[level]}`}
                    onClick={() => setEnergy(level)}
                    className={`h-14 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${level <= energy ? "bg-[#41637f]" : "bg-slate-200"
                      } ${energy === level ? "ring-2 ring-slate-950 ring-offset-2" : ""}`}
                  />
                ))}
              </div>
              <div aria-hidden="true" className="h-7 w-1.5 rounded-full bg-slate-300" />
            </div>
          </fieldset>

          <p
            aria-live="polite"
            className={status === "idle" ? "sr-only" : "text-base font-semibold text-slate-700"}
          >
            {status === "loading" && "Building a workout that fits today."}
            {status === "error" && "Something went wrong. Your check-in is saved, so try again when ready."}
          </p>

          <button
            type="button"
            onClick={createWorkout}
            disabled={status === "loading"}
            className="min-h-14 w-full rounded-xl bg-[#41637f] px-3 text-base font-black text-white transition-colors hover:bg-[#34516a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Creating today's workout" : "Create today's workout"}
          </button>

          {workout && status !== "loading" && (
            <Link
              href="/exercise"
              className="block min-h-12 rounded-xl border border-slate-300 px-4 py-3 text-center text-base font-bold text-[#41637f] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Continue tracked exercise
            </Link>
          )}
        </div>
      </section>

      <section
        aria-labelledby="movement-session-title"
        className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-[0_18px_38px_rgba(15,23,42,0.08)] lg:p-8"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 id="movement-session-title" className="text-xl font-black text-slate-950">
              Movement session
            </h2>
            <p className="text-base leading-7 text-slate-700">
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
    </div>
  );
}

function OnboardingPrompt() {
  return (
    <section
      aria-labelledby="onboarding-title"
      className="rounded-[1.35rem] border-2 border-[#41637f] bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)] lg:col-span-2 lg:p-8"
    >
      <div className="space-y-3">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#41637f]">
          First visit
        </p>
        <h2 id="onboarding-title" className="text-xl font-black text-slate-950">
          Set up your ability profile
        </h2>
        <p className="text-base leading-7 text-slate-700">
          Choose positions, equipment, movement limits, and sensory preferences
          before today&apos;s workout is built.
        </p>
        <Link
          href="/onboarding"
          className="flex min-h-12 items-center justify-center rounded-xl bg-[#41637f] px-4 text-base font-black text-white hover:bg-[#34516a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
      className="flex min-h-12 items-center justify-between rounded-xl border border-slate-300 px-4 text-base font-black text-slate-950 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <span>{label}</span>
      <ArrowRight aria-hidden="true" className="h-5 w-5 text-slate-400" />
    </Link>
  );
}