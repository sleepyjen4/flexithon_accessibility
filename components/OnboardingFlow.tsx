"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Abilities, BodyRegion, Equipment, Position } from "@/types";
import { useProfileStore } from "@/store/profile";
import { ChoiceList } from "@/components/ChoiceList";
import { Button } from "@/components/Button";

const POSITION_OPTIONS: { value: Position; label: string; description: string }[] = [
  { value: "seated", label: "Seated", description: "In a chair or wheelchair" },
  { value: "lying", label: "Lying down", description: "On a bed, mat, or floor" },
  { value: "standing", label: "Standing", description: "With or without support" },
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string; description?: string }[] = [
  { value: "none", label: "No equipment", description: "Bodyweight only" },
  { value: "resistance_band", label: "Resistance band" },
  { value: "dumbbell", label: "Dumbbells or hand weights" },
  { value: "chair", label: "A sturdy chair" },
  { value: "wall", label: "A clear wall" },
];

const REGION_OPTIONS: { value: BodyRegion; label: string }[] = [
  { value: "neck", label: "Neck" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "back", label: "Upper back" },
  { value: "lower_back", label: "Lower back" },
  { value: "core", label: "Core" },
  { value: "hips", label: "Hips" },
  { value: "legs", label: "Legs" },
];

const SENSORY_OPTIONS = [
  { value: "captions", label: "Captions", description: "Text for all audio content" },
  { value: "reduced_motion", label: "Reduced motion", description: "Calmer screens, fewer animations" },
  { value: "haptics", label: "Haptics", description: "Gentle vibration cues on timers" },
] as const;

type SensoryKey = (typeof SENSORY_OPTIONS)[number]["value"];

const STEPS = [
  {
    title: "How do you like to move?",
    intro: "Pick every position that works for you. You can change this any time.",
  },
  {
    title: "What do you have around?",
    intro: "We only suggest exercises that use what you already have.",
  },
  {
    title: "Anything we should work around?",
    intro: "We'll steer clear of these areas. Optional — skip if nothing applies.",
  },
  {
    title: "How should the app feel?",
    intro: "Sensory preferences, plus a name if you'd like one.",
  },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** F1: ability-profile onboarding. 4 screens, all skippable, never asks
 * for diagnoses. Saves to the profile store and heads to check-in. */
export function OnboardingFlow() {
  const router = useRouter();
  const setProfile = useProfileStore((state) => state.setProfile);
  const [step, setStep] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [avoidRegions, setAvoidRegions] = useState<BodyRegion[]>([]);
  const [sensory, setSensory] = useState<SensoryKey[]>(["captions"]);
  const [displayName, setDisplayName] = useState("");

  const finish = () => {
    const abilities: Abilities = {
      // Skipped steps get inclusive defaults, never empty filters.
      positions: positions.length > 0 ? positions : ["seated", "lying"],
      equipment: equipment.length > 0 ? [...new Set([...equipment, "none" as Equipment])] : ["none", "chair", "wall"],
      avoid_regions: avoidRegions,
      sensory: {
        captions: sensory.includes("captions"),
        reduced_motion: sensory.includes("reduced_motion"),
        haptics: sensory.includes("haptics"),
      },
    };
    setProfile(displayName.trim() || null, abilities);
    router.push("/check-in");
  };

  const next = () => (step === STEPS.length - 1 ? finish() : setStep(step + 1));

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <p className="text-base font-medium text-slate-600">
        Step {step + 1} of {STEPS.length}
      </p>
      <h1 className="text-2xl font-bold text-slate-900">{STEPS[step].title}</h1>
      <p className="text-slate-600">{STEPS[step].intro}</p>

      {step === 0 && (
        <ChoiceList
          legend="Positions you can exercise in"
          options={POSITION_OPTIONS}
          selected={positions}
          onToggle={(value) => setPositions((current) => toggle(current, value))}
        />
      )}
      {step === 1 && (
        <ChoiceList
          legend="Equipment you have available"
          options={EQUIPMENT_OPTIONS}
          selected={equipment}
          onToggle={(value) => setEquipment((current) => toggle(current, value))}
        />
      )}
      {step === 2 && (
        <ChoiceList
          legend="Body areas to avoid"
          options={REGION_OPTIONS}
          selected={avoidRegions}
          onToggle={(value) => setAvoidRegions((current) => toggle(current, value))}
        />
      )}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <ChoiceList
            legend="Sensory preferences"
            options={[...SENSORY_OPTIONS]}
            selected={sensory}
            onToggle={(value) => setSensory((current) => toggle(current, value))}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="display-name" className="text-lg font-semibold text-slate-900">
              What should we call you? (optional)
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 text-lg text-slate-900"
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <Button type="button" onClick={next}>
          {step === STEPS.length - 1 ? "Finish — check in" : "Continue"}
        </Button>
        {step < STEPS.length - 1 && (
          <Button type="button" variant="secondary" onClick={next}>
            Skip this step
          </Button>
        )}
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
