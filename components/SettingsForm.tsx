"use client";

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

const TOGGLES: { key: "high_contrast" | "reduced_motion" | "haptics" | "speech_enabled"; label: string; description: string }[] = [
  { key: "high_contrast", label: "High contrast", description: "Stronger text and borders" },
  { key: "reduced_motion", label: "Reduced motion", description: "Minimise animation" },
  { key: "speech_enabled", label: "Spoken instructions", description: "Exercise cues and rep counts" },
  { key: "haptics", label: "Haptics", description: "Vibrate when a timer finishes" },
];

/** F7: accessibility settings. Applied instantly app-wide and persisted
 * on this device — there is no account, so nothing is sent anywhere. */
export function SettingsForm() {
  const prefs = useProfileStore((state) => state.prefs);
  const setPrefs = useProfileStore((state) => state.setPrefs);

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
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-center justify-between gap-4">
              <label htmlFor={`setting-${toggle.key}`} className="flex flex-col">
                <span className="text-lg font-black text-ink">{toggle.label}</span>
                <span className="text-base text-ink-soft">{toggle.description}</span>
              </label>
              <Switch.Root
                id={`setting-${toggle.key}`}
                checked={prefs[toggle.key]}
                onCheckedChange={(checked) => update({ ...prefs, [toggle.key]: checked })}
                className="relative h-9 w-16 shrink-0 rounded-full bg-line-strong p-1 transition-colors duration-300 ease-smooth data-[state=checked]:bg-raspberry"
              >
                <Switch.Thumb className="block h-7 w-7 rounded-full bg-milk shadow-sm transition-transform duration-300 ease-smooth data-[state=checked]:translate-x-7" />
              </Switch.Root>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
