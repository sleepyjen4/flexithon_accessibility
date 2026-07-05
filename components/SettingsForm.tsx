"use client";

import Link from "next/link";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import type { AccessibilityPrefs } from "@/types";
import { useProfileStore } from "@/store/profile";
import { savePrefsToSupabase } from "@/lib/prefs";
import { Card } from "@/components/Card";

const TEXT_SIZES: { value: AccessibilityPrefs["text_size"]; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "x-large", label: "Larger" },
];

const TOGGLES: { key: "high_contrast" | "reduced_motion" | "haptics" | "speech_enabled"; label: string; description: string }[] = [
  { key: "high_contrast", label: "High contrast", description: "Stronger text and borders" },
  { key: "reduced_motion", label: "Reduced motion", description: "Minimise animation" },
  { key: "speech_enabled", label: "Spoken instructions", description: "Exercise cues and rep counts" },
  { key: "haptics", label: "Haptics", description: "Vibrate when a timer finishes" },
];

/** F7: accessibility settings. Applied instantly app-wide and persisted;
 * mirrored to the Supabase profile when signed in. */
export function SettingsForm() {
  const prefs = useProfileStore((state) => state.prefs);
  const setPrefs = useProfileStore((state) => state.setPrefs);

  const update = (next: AccessibilityPrefs) => {
    setPrefs(next);
    void savePrefsToSupabase(next);
  };

  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <h2 className="text-xl font-black text-ink">Movement tracking</h2>
        <p className="mt-3 text-base leading-7 text-ink-soft">
          Set once when you start out — the app learns your comfortable range so
          hands-free rep-counting fits how you move. Recalibrate anytime.
        </p>
        <Link
          href="/calibrate"
          className="mt-4 grid min-h-14 grid-cols-[1fr_auto] items-center rounded-xl border-2 border-line-strong px-4 text-center text-base font-black text-ink hover:bg-cream"
        >
          <span>Recalibrate movement range</span>
          <span className="pl-4 text-sm font-black text-ink-soft">Start</span>
        </Link>
      </Card>

      <Card className="shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <h2 className="text-xl font-black text-ink">Display & accessibility</h2>

        <div className="mt-6 flex flex-col gap-3">
          <h3 className="text-lg font-black text-ink" id="text-size-label">
            Text size
          </h3>
          <RadioGroup.Root
            value={prefs.text_size}
            onValueChange={(value) =>
              update({ ...prefs, text_size: value as AccessibilityPrefs["text_size"] })
            }
            aria-labelledby="text-size-label"
            className="grid grid-cols-3 gap-1 rounded-xl bg-cream p-1"
          >
            {TEXT_SIZES.map((size) => (
              <RadioGroup.Item
                key={size.value}
                value={size.value}
                className="flex min-h-12 min-w-0 items-center justify-center rounded-lg px-1 text-center text-[13px] font-black leading-none text-ink hover:bg-surface data-[state=checked]:bg-evergreen data-[state=checked]:text-milk sm:text-sm md:text-base"
              >
                <span className="whitespace-nowrap">{size.label}</span>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-center justify-between gap-4">
              <label htmlFor={`setting-${toggle.key}`} className="flex flex-col">
                <span className="text-lg font-black text-ink">{toggle.label}</span>
                <span className="text-sm text-ink-soft">{toggle.description}</span>
              </label>
              <Switch.Root
                id={`setting-${toggle.key}`}
                checked={prefs[toggle.key]}
                onCheckedChange={(checked) => update({ ...prefs, [toggle.key]: checked })}
                className="relative h-9 w-16 shrink-0 rounded-full bg-line-strong p-1 transition-colors data-[state=checked]:bg-evergreen"
              >
                <Switch.Thumb className="block h-7 w-7 rounded-full bg-milk shadow-sm transition-transform data-[state=checked]:translate-x-7" />
              </Switch.Root>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
