"use client";

import { useState } from "react";
import type { EnergyLevel, EnergyPreviewPlan } from "@/types";

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  1: "Running on empty",
  2: "Low but moving",
  3: "Steady",
  4: "Good energy",
  5: "Full tank",
};

/** Tallest bar in the chart, so intensity reads as height rather than colour. */
const MAX_INTENSITY = 4;

/**
 * The landing page's one interactive claim: move the dial, watch the plan
 * change.
 *
 * Every plan here is real output from `lib/workoutBuilder`, computed by the
 * server at build time and handed over as plain data — the same generator the
 * app runs, so the page cannot promise something the product does not do.
 *
 * The chart carries three variables at once without a colour scale: one bar
 * per exercise (how many), bar height by intensity (how hard), and the work
 * interval printed alongside (how long). Colour is never the only channel
 * (Section 6, rule 5) — the same numbers are in the text beneath it, which is
 * also what a screen reader announces.
 */
export function EnergyPreview({ plans }: { plans: EnergyPreviewPlan[] }) {
  const [energy, setEnergy] = useState<EnergyLevel>(2);
  const plan = plans.find((entry) => entry.energy === energy) ?? plans[0];

  if (!plan) return null;

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-raspberry">
        Try it
      </p>
      <h2 className="mt-2 font-display text-xl font-bold text-ink">
        How much do you have today?
      </h2>

      <fieldset className="mt-5">
        <legend className="sr-only">
          Preview the plan built for an energy level
        </legend>
        <div className="grid grid-cols-5 gap-2">
          {plans.map((entry) => {
            const selected = entry.energy === energy;
            return (
              <button
                key={entry.energy}
                type="button"
                aria-pressed={selected}
                aria-label={`${entry.energy}: ${ENERGY_LABELS[entry.energy]}`}
                onClick={() => setEnergy(entry.energy)}
                className={`min-h-12 rounded-xl border-2 font-display text-lg font-extrabold transition-colors duration-200 ease-smooth ${
                  selected
                    ? "border-raspberry-deep bg-raspberry text-milk"
                    : "border-line-strong bg-surface text-ink hover:bg-mint"
                }`}
              >
                {entry.energy}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-3 text-base font-bold text-ink-soft">
        {ENERGY_LABELS[energy]}
      </p>

      {/* Bars grow to a capped width rather than splitting the row evenly:
          an even split would make eight exercises look like four thinner ones
          and hide the very thing the dial is meant to show, while a fixed
          width overflowed. At 320px and the X-Large text size eight rem-sized
          bars wanted 297px inside a 267px card, which pushed the card to 365px
          in a 320px viewport — and the hero clips rather than scrolls, so the
          card was silently cut off. The cap keeps step count readable as row
          length wherever there is room, and yields instead of overflowing.

          Keyed on energy so React remounts the row and the house `rise-in`
          replays as a stagger on every change — reusing that class rather than
          a new keyframe also means it inherits both reduced-motion gates.
          Decorative: the sentence below states the same numbers in words. */}
      <div
        key={plan.energy}
        aria-hidden="true"
        className="mt-6 flex h-24 items-end gap-2 border-b-2 border-line"
      >
        {plan.steps.map((step, index) => (
          <div
            key={`${step.name}-${index}`}
            style={{
              height: `${(step.intensity / MAX_INTENSITY) * 100}%`,
              animationDelay: `${index * 45}ms`,
            }}
            className="rise-in w-full max-w-5 flex-1 rounded-t-md bg-raspberry"
          />
        ))}
      </div>

      {/* Every plan occupies the same grid cell, with the inactive ones held
          by `invisible` (visibility, not display, so they still size the
          grid). The card therefore reserves the tallest plan up front and its
          height never changes as the dial moves.

          Without this the card grew 723px -> 817px between energy 1 and 5.
          The hero centres its two columns, so half of that pushed the heading
          and copy on the left down by 47px on every click, and the whole
          remainder of the page moved with it — on mobile too, where the
          columns stack and the left column itself never moved.

          Reserving the height rather than switching the hero to items-start
          fixes the page shift as well as the column shift, and keeps the
          centred composition.

          The stack is decorative to assistive tech; the live region below
          carries the same content as one sentence, which announces more
          cleanly than three paragraphs whose siblings are toggling. */}
      <div aria-hidden="true" className="mt-5 grid">
        {plans.map((entry) => (
          <div
            key={entry.energy}
            className={`col-start-1 row-start-1 ${
              entry.energy === energy ? "" : "invisible"
            }`}
          >
            <p className="font-display text-2xl font-extrabold text-ink">
              {entry.title}
            </p>
            <p className="mt-1 text-base leading-7 text-ink-soft">
              {entry.steps.length} exercises · about {entry.minutes} minutes ·{" "}
              {entry.work_seconds} seconds of work each.
            </p>
            <p className="mt-3 text-base leading-7 text-ink">
              {entry.steps.map((step) => step.name).join(", ")}.
            </p>
          </div>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {`${plan.title}. ${plan.steps.length} exercises, about ${plan.minutes} minutes, ${plan.work_seconds} seconds of work each. ${plan.steps
          .map((step) => step.name)
          .join(", ")}.`}
      </p>

      <p className="mt-5 border-t border-line pt-4 text-base leading-7 text-ink-soft">
        A sample profile: seated, a chair and a resistance band. Yours is built
        from what you tell us you have.
      </p>
    </div>
  );
}
