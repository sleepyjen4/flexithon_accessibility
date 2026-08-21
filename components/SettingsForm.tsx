"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import type { AccessibilityPrefs } from "@/types";
import { useProfileStore } from "@/store/profile";
import { Card } from "@/components/Card";

/** `preview` renders "Aa" at the size each option selects, so the effect can be
 * judged before committing to it. Sizes are absolute (not rem) so the preview
 * stays truthful even after the root size has already been changed. */
const TEXT_SIZES: {
  value: AccessibilityPrefs["text_size"];
  label: string;
  preview: string;
}[] = [
  { value: "compact", label: "Compact", preview: "text-[16px]" },
  { value: "normal", label: "Normal", preview: "text-[18px]" },
  { value: "large", label: "Large", preview: "text-[20px]" },
  { value: "x-large", label: "Extra Large", preview: "text-[22px]" },
];

/** `requires` marks a toggle whose promise depends on a browser capability that
 * may simply be absent — Safari has never shipped the Vibration API, on iOS or
 * macOS. `unsupportedNote` is what we say instead of that promise: a fact about
 * the browser, never a fault of the user or their device. It lives here as a
 * plain string (not JSX) so the apostrophe needs no escaping. */
const TOGGLES: {
  key: "high_contrast" | "reduced_motion" | "haptics" | "speech_enabled";
  label: string;
  description: string;
  requires?: "vibration";
  unsupportedNote?: string;
}[] = [
  { key: "high_contrast", label: "High contrast", description: "Stronger text and borders" },
  { key: "reduced_motion", label: "Reduced motion", description: "Minimise animation" },
  { key: "speech_enabled", label: "Spoken instructions", description: "Exercise cues and rep counts" },
  {
    key: "haptics",
    label: "Haptics",
    description: "Vibrate when a timer finishes",
    requires: "vibration",
    unsupportedNote: "This browser doesn't support vibration, so timers here finish quietly.",
  },
];

/** Vibration support cannot change during a session, so there is nothing to
 * subscribe to — a stable no-op keeps useSyncExternalStore from resubscribing
 * on every render. Safari has never shipped the Vibration API, on iOS or
 * macOS, so this is `false` for every iPhone and iPad. */
const subscribeToVibrationSupport = () => () => {};
const getVibrationSupport = () => typeof navigator.vibrate === "function";
/** SSR has no `navigator`. Reporting supported on the server means the markup
 * React hydrates against carries no disabled state or note, matching the
 * client's first render exactly. */
const getVibrationSupportOnServer = () => true;

/** F7: accessibility settings. Applied instantly app-wide and persisted
 * on this device — there is no account, so nothing is sent anywhere. */
export function SettingsForm() {
  const prefs = useProfileStore((state) => state.prefs);
  const setPrefs = useProfileStore((state) => state.setPrefs);

  // Read through useSyncExternalStore rather than an effect: the server
  // snapshot is declared, so SSR output and the first client render agree by
  // construction instead of by an optimistic initial value that an effect then
  // corrects. That also keeps `navigator` out of render on the server, where it
  // does not exist. Unlike the TodayDashboard bug, nothing here is seeded from
  // a store — the source of truth is the browser, and it is read every render
  // rather than captured once.
  const vibrationSupported = useSyncExternalStore(
    subscribeToVibrationSupport,
    getVibrationSupport,
    getVibrationSupportOnServer,
  );

  const update = (next: AccessibilityPrefs) => {
    setPrefs(next);
  };

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <h2 className="text-xl font-black text-ink">Movement tracking</h2>
        <p className="mt-3 text-base leading-7 text-ink-soft">
          Set once when you start out — the app learns your comfortable range so
          hands-free rep-counting fits how you move. Recalibrate anytime.
        </p>
        <Link
          href="/calibrate"
          className="mt-4 grid min-h-14 grid-cols-[1fr_auto] items-center rounded-xl border-2 border-line-strong px-4 text-center text-base font-black text-ink transition-[background-color,transform,box-shadow] duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-cream hover:shadow-card active:translate-y-0 active:duration-150"
        >
          <span>Recalibrate movement range</span>
          <span className="pl-4 text-sm font-black text-ink-soft">Start</span>
        </Link>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-ink">Display & accessibility</h2>

        <div className="mt-6 flex flex-col gap-3">
          <h3 className="text-lg font-black text-ink" id="text-size-label">
            Text size
          </h3>
          {/* Stacked on mobile: three across at 390px left each option 90px
              wide, which forced the labels to 13.5px — the smallest text on the
              screen, on the control whose whole job is sizing text. Full-width
              rows give them 18px; gap-2 keeps 8px between adjacent touch
              targets. Two-up above sm, since four across would recreate the
              same squeeze one breakpoint higher. */}
          <RadioGroup.Root
            value={prefs.text_size}
            onValueChange={(value) =>
              update({ ...prefs, text_size: value as AccessibilityPrefs["text_size"] })
            }
            aria-labelledby="text-size-label"
            className="grid grid-cols-1 gap-2 rounded-xl bg-cream p-2 sm:grid-cols-2"
          >
            {TEXT_SIZES.map((size) => (
              <RadioGroup.Item
                key={size.value}
                value={size.value}
                className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-center text-base font-black leading-tight text-ink transition-colors duration-300 ease-smooth hover:bg-surface data-[state=checked]:bg-raspberry data-[state=checked]:text-milk"
              >
                {/* Each option previews the size it selects, so "Extra Large"
                    can be judged before committing to it. Decorative — the
                    label beside it carries the meaning. */}
                <span aria-hidden="true" className={size.preview}>
                  Aa
                </span>
                <span>{size.label}</span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {TOGGLES.map((toggle) => {
            const unsupported = toggle.requires === "vibration" && !vibrationSupported;
            const noteId = `setting-${toggle.key}-note`;
            return (
              <div key={toggle.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={`setting-${toggle.key}`} className="flex flex-col">
                    <span className="text-lg font-black text-ink">{toggle.label}</span>
                    <span className="text-base text-ink-soft">{toggle.description}</span>
                  </label>
                  {/* The control is left in place rather than removed: the
                      preference is real and stored, and a row that disappears
                      on one device reads as a bug. Disabled + a stated reason
                      keeps the setting visible and stops the row promising
                      something the browser cannot do.

                      The track paints at h-9 (40.5px at the 18px root) but
                      the transparent `before` overlay makes the hit area
                      h-12 (3rem) x full width. Spacing is rem-based and the
                      text-size setting moves the root between 16px and 22px,
                      so 3rem is 48px at the smallest setting and larger at
                      every other one — the 48px floor in AGENTS.md 6.1 holds
                      throughout, without inflating the switch on the one
                      screen meant to look calm. Padding was the alternative
                      but it grows the painted pill (backgrounds fill the
                      padding box) and the focus outline with it; the overlay
                      leaves both tight to the visible control. Being
                      absolutely positioned it changes no layout, and it does
                      not widen the switch, so the label keeps its own hit
                      area. Rows are as tall as their two-line label (~58px at
                      the 18px root) with gap-5 between, so the overlay stays
                      inside its row. */}
                  <Switch.Root
                    id={`setting-${toggle.key}`}
                    checked={prefs[toggle.key]}
                    disabled={unsupported}
                    aria-describedby={unsupported ? noteId : undefined}
                    onCheckedChange={(checked) => update({ ...prefs, [toggle.key]: checked })}
                    className="relative h-9 w-16 shrink-0 rounded-full bg-line-strong p-1 transition-colors duration-300 ease-smooth before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 before:content-[''] data-[state=checked]:bg-raspberry disabled:opacity-60"
                  >
                    <Switch.Thumb className="block h-7 w-7 rounded-full bg-milk shadow-sm transition-transform duration-300 ease-smooth data-[state=checked]:translate-x-7" />
                  </Switch.Root>
                </div>
                {/* Real text, outside the <label> so it describes the switch
                    rather than being folded into its accessible name. A bare
                    `disabled` announces "dimmed" and nothing else. */}
                {unsupported ? (
                  <p id={noteId} className="text-base leading-7 text-ink-soft">
                    {toggle.unsupportedNote}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
