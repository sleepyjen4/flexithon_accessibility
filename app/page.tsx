import Link from "next/link";
import { Armchair, BatteryLow, Check, Dumbbell, ShieldCheck, X } from "lucide-react";
import { EnergyPreview } from "@/components/EnergyPreview";
import { WelcomeCta } from "@/components/WelcomeCta";
import { EXERCISES, getExerciseById } from "@/lib/exercises";
import { buildWorkout } from "@/lib/workoutBuilder";
import type { Abilities, EnergyLevel, EnergyPreviewPlan } from "@/types";

/** A representative profile for the preview dial — seated, a chair, a band.
 * Named on screen so the page never implies it knows the visitor's body. */
const PREVIEW_ABILITIES: Abilities = {
  positions: ["seated"],
  equipment: ["none", "chair", "resistance_band"],
  avoid_regions: [],
  sensory: { captions: true, reduced_motion: false, haptics: false },
};

/** Runs the real generator at build time, so the landing page shows the
 * product's output and ships none of the exercise library to the browser. */
function previewPlans(): EnergyPreviewPlan[] {
  return ([1, 2, 3, 4, 5] as EnergyLevel[]).flatMap((energy) => {
    const result = buildWorkout({ abilities: PREVIEW_ABILITIES, energy });
    if (!result.ok) return [];

    const { workout } = result;
    return [
      {
        energy,
        title: workout.title,
        minutes: workout.estimated_minutes,
        work_seconds: workout.steps[0]?.duration_seconds ?? 0,
        steps: workout.steps.map((step) => ({
          name: getExerciseById(step.exercise_id)?.name ?? "Exercise",
          intensity: getExerciseById(step.exercise_id)?.intensity ?? 1,
        })),
      },
    ];
  });
}

const ADAPTS = [
  {
    icon: Armchair,
    title: "Your position",
    body: "Seated, lying down, or standing with support. Every movement pattern has a variant, not a substitute.",
  },
  {
    icon: Dumbbell,
    title: "Your equipment",
    body: "A band, a chair, a wall, a wheelchair, or nothing at all. The library is filtered to what is actually in the room.",
  },
  {
    icon: BatteryLow,
    title: "Your energy today",
    body: "Check in on a scale of one to five. A hard day gets a shorter, gentler plan — not the same plan with guilt attached.",
  },
];

const NOT_COUNTED = ["Steps walked", "Calories burned", "Streaks broken"];
const COUNTED = ["Showing up", "Effort you chose", "Range of motion over time"];

export default function WelcomePage() {
  const plans = previewPlans();

  return (
    <div className="flex flex-1 flex-col bg-cream">
      <section className="hero-wash relative overflow-hidden">
        <div aria-hidden="true" className="paper-grid absolute inset-0" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-16 lg:py-16">
          <div className="flex flex-col items-start gap-6 text-left">
            <div className="rise-in space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-raspberry">
                Adaptive fitness
              </p>
              <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl xl:text-6xl">
                Fitness that meets your body where it is.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-ink-soft">
                Alfa builds today&apos;s workout around your positions, your
                equipment, and your energy, not a generic standard you&apos;re
                expected to hit.
              </p>
            </div>

            <div className="rise-in rise-in-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <WelcomeCta
                tone="hero"
                startLabel="Get started"
                continueLabel="Continue to your dashboard"
              />
              <Link
                href="/library"
                className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-ink px-8 text-lg font-bold text-ink transition-colors hover:bg-mint"
              >
                Browse {EXERCISES.length} exercises
              </Link>
            </div>

            <p className="rise-in rise-in-3 inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2.5 text-base font-bold text-ink-soft">
              <ShieldCheck aria-hidden="true" className="h-5 w-5 text-evergreen" />
              No account. Your profile and camera never leave this device.
            </p>
          </div>

          <div className="rise-in rise-in-4 w-full">
            <EnergyPreview plans={plans} />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="counts-title"
        className="border-y border-line bg-surface px-5 py-16 lg:py-20"
      >
        <div className="reveal mx-auto max-w-6xl">
          <h2
            id="counts-title"
            className="max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl"
          >
            Progress you can keep on a bad week.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-soft">
            Fluctuating conditions make most fitness metrics punishing. So this
            app measures the part you control.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-line bg-cream p-7">
              <h3 className="font-display text-lg font-bold text-ink">
                What Alfa never counts
              </h3>
              <ul className="mt-4 space-y-3">
                {NOT_COUNTED.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-lg text-ink-soft">
                    <X aria-hidden="true" className="h-5 w-5 shrink-0" />
                    <span className="line-through">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border-2 border-evergreen bg-mint p-7">
              <h3 className="font-display text-lg font-bold text-ink">
                What it counts instead
              </h3>
              <ul className="mt-4 space-y-3">
                {COUNTED.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-lg font-bold text-ink">
                    <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-evergreen" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="adapts-title" className="px-5 py-16 lg:py-20">
        <div className="reveal mx-auto max-w-6xl">
          <h2
            id="adapts-title"
            className="max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl"
          >
            Three things the plan bends around.
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {ADAPTS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-line bg-surface p-7 shadow-card"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lavender text-lavender-deep"
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-ink">
                  {title}
                </h3>
                <p className="mt-2 text-base leading-7 text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="on-dark bg-stage px-5 py-16 text-center lg:py-24">
        <div className="reveal mx-auto flex max-w-2xl flex-col items-center gap-6">
          <blockquote>
            <p className="font-display text-2xl font-extrabold leading-snug text-milk sm:text-3xl">
              &ldquo;Some days call for strength. Others call for stillness.
              Both count.&rdquo;
            </p>
          </blockquote>
          <p className="text-lg leading-8 text-milk-soft">
            Set up your ability profile once, then check in whenever you move.
            Good day or hard day, no penalty either way.
          </p>
          <WelcomeCta
            tone="band"
            startLabel="Create your profile"
            continueLabel="Go to your dashboard"
          />
        </div>
      </section>
    </div>
  );
}
