"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import type { AccessibilityPrefs } from "@/types";
import { useProfileStore } from "@/store/profile";
import { savePrefsToSupabase } from "@/lib/prefs";

const TEXT_SIZES: { value: AccessibilityPrefs["text_size"]; label: string }[] = [
  { value: "normal", label: "Standard" },
  { value: "large", label: "Large" },
  { value: "x-large", label: "Extra large" },
];

const TOGGLES: { key: "high_contrast" | "reduced_motion" | "haptics" | "speech_enabled"; label: string; description: string }[] = [
  { key: "high_contrast", label: "High contrast", description: "Darker text and stronger borders" },
  { key: "reduced_motion", label: "Reduce motion", description: "Turn off animations and transitions" },
  { key: "haptics", label: "Haptics", description: "Vibrate when a timer finishes" },
  { key: "speech_enabled", label: "Spoken instructions & rep counts", description: "Turn off to keep the workout silent" },
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
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900" id="text-size-label">
          Text size
        </h2>
        <RadioGroup.Root
          value={prefs.text_size}
          onValueChange={(value) =>
            update({ ...prefs, text_size: value as AccessibilityPrefs["text_size"] })
          }
          aria-labelledby="text-size-label"
          className="flex flex-col gap-3"
        >
          {TEXT_SIZES.map((size) => (
            <RadioGroup.Item
              key={size.value}
              value={size.value}
              className="flex min-h-12 w-full items-center justify-between rounded-xl border-2 border-slate-300 bg-white px-4 text-left text-lg font-medium text-slate-900 hover:bg-slate-50 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-50"
            >
              <span>{size.label}</span>
              <RadioGroup.Indicator aria-hidden="true" className="text-xl font-bold text-indigo-700">
                ✓
              </RadioGroup.Indicator>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>

      {TOGGLES.map((toggle) => (
        <div key={toggle.key} className="flex items-center justify-between gap-4">
          <label htmlFor={`setting-${toggle.key}`} className="flex flex-col">
            <span className="text-lg font-semibold text-slate-900">{toggle.label}</span>
            <span className="text-base text-slate-600">{toggle.description}</span>
          </label>
          <Switch.Root
            id={`setting-${toggle.key}`}
            checked={prefs[toggle.key]}
            onCheckedChange={(checked) => update({ ...prefs, [toggle.key]: checked })}
            className="relative h-12 w-20 shrink-0 rounded-full bg-slate-400 p-1 transition-colors data-[state=checked]:bg-indigo-600"
          >
            <Switch.Thumb className="block h-10 w-10 rounded-full bg-white transition-transform data-[state=checked]:translate-x-8" />
          </Switch.Root>
        </div>
      ))}
    </div>
  );
}
