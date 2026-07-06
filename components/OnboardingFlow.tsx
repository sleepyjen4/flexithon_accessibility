"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Armchair,
  BrickWall,
  CircleDot,
  Droplets,
  Dumbbell,
  Footprints,
  Hand,
  HandGrab,
  LifeBuoy,
  MoveDiagonal,
  ScanFace,
  Shirt,
  Sofa,
  StretchHorizontal,
  StretchVertical,
  User,
  Waves,
  Weight,
} from "lucide-react";
import type { Abilities, BodyRegion, Equipment, Position } from "@/types";
import { useProfileStore } from "@/store/profile";
import { ChoiceList } from "@/components/ChoiceList";
import { Button } from "@/components/Button";

const POSITION_OPTIONS: {
  value: Position;
  label: string;
  description: string;
}[] = [
    { value: "seated", label: "Seated", description: "In a chair or wheelchair" },
    {
      value: "lying",
      label: "Lying down",
      description: "On a bed, mat, or floor",
    },
    {
      value: "standing",
      label: "Standing",
      description: "With or without support",
    },
  ];

const EQUIPMENT_OPTIONS: {
  value: Equipment;
  label: string;
  description?: string;
  icon: typeof User;
}[] = [
    {
      value: "none",
      label: "No equipment",
      description: "Bodyweight only",
      icon: User,
    },
    { value: "resistance_band", label: "Resistance band", icon: Waves },
    { value: "dumbbell", label: "Dumbbells or hand weights", icon: Dumbbell },
    { value: "chair", label: "A sturdy chair", icon: Armchair },
    { value: "wall", label: "A clear wall", icon: BrickWall },
    { value: "wheelchair", label: "Wheelchair", icon: Accessibility },
    { value: "bench", label: "Bench", icon: Sofa },
    { value: "ankle_weights", label: "Ankle weights", icon: Weight },
    {
      value: "support_surface",
      label: "Support surface",
      description: "Counter, rail, or stable table",
      icon: BrickWall,
    },
    {
      value: "mobility_aid",
      label: "Mobility aid",
      description: "Cane, walker, prosthesis, or crutches",
      icon: LifeBuoy,
    },
    { value: "gripper_putty", label: "Gripper or putty", icon: HandGrab },
    { value: "pool_access", label: "Pool access", icon: Droplets },
  ];

const REGION_OPTIONS: {
  value: BodyRegion;
  label: string;
  icon: typeof User;
}[] = [
    { value: "neck", label: "Neck", icon: ScanFace },
    { value: "shoulders", label: "Shoulders", icon: Shirt },
    { value: "arms", label: "Arms", icon: Hand },
    { value: "back", label: "Upper back", icon: StretchVertical },
    { value: "lower_back", label: "Lower back", icon: StretchHorizontal },
    { value: "core", label: "Core", icon: CircleDot },
    { value: "hips", label: "Hips", icon: MoveDiagonal },
    { value: "legs", label: "Legs", icon: Footprints },
  ];

const SENSORY_OPTIONS = [
  {
    value: "captions",
    label: "Captions",
    description: "Text for all audio content",
  },
  {
    value: "reduced_motion",
    label: "Reduced motion",
    description: "Calmer screens, fewer animations",
  },
  {
    value: "haptics",
    label: "Haptics",
    description: "Gentle vibration cues on timers",
  },
] as const;

type SensoryKey = (typeof SENSORY_OPTIONS)[number]["value"];

const STEPS = [
  {
    title: "How do you like to move?",
    intro:
      "Pick every position that works for you. You can change this any time.",
  },
  {
    title: "What do you have around?",
    intro: "We only suggest exercises that use what you already have.",
  },
  {
    title: "Anything we should work around?",
    intro: "We'll steer clear of these areas. Optional.",
  },
  {
    title: "How should the app feel?",
    intro: "Set the sensory preferences that suit you. Optional — skip if none apply.",
  },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/** F1: ability-profile onboarding. 4 screens, all skippable, never asks
 * for diagnoses. Saves to the profile store and heads to check-in. */
export function OnboardingFlow() {
  const router = useRouter();
  const setAbilities = useProfileStore((state) => state.setAbilities);
  const [step, setStep] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [avoidRegions, setAvoidRegions] = useState<BodyRegion[]>([]);
  const [sensory, setSensory] = useState<SensoryKey[]>(["captions"]);

  const finish = () => {
    const abilities: Abilities = {
      // Skipped steps get inclusive defaults, never empty filters.
      positions: positions.length > 0 ? positions : ["seated", "lying"],
      equipment:
        equipment.length > 0
          ? [...new Set([...equipment, "none" as Equipment])]
          : ["none", "chair", "wall"],
      avoid_regions: avoidRegions,
      sensory: {
        captions: sensory.includes("captions"),
        reduced_motion: sensory.includes("reduced_motion"),
        haptics: sensory.includes("haptics"),
      },
    };
    // The display name is captured at registration; onboarding only sets
    // abilities so it never clobbers a name saved earlier.
    setAbilities(abilities);
    router.push("/dashboard");
  };

  const next = () => (step === STEPS.length - 1 ? finish() : setStep(step + 1));

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-raspberry">
          Step {step + 1} of {STEPS.length}
        </p>
        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Onboarding step ${step + 1} of ${STEPS.length}`}
          className="flex gap-1.5"
        >
          {STEPS.map((_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ease-smooth ${index <= step ? "bg-ink" : "bg-line"
                }`}
            />
          ))}
        </div>
      </div>
      <h1 className="font-display text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
        {STEPS[step].title}
      </h1>
      <p className="text-lg text-ink-soft">{STEPS[step].intro}</p>

      {step === 0 && (
        <ChoiceList
          legend="Positions you can exercise in"
          options={POSITION_OPTIONS}
          selected={positions}
          onToggle={(value) =>
            setPositions((current) => toggle(current, value))
          }
        />
      )}
      {step === 1 && (
        <ChoiceList
          legend="Equipment you have available"
          options={EQUIPMENT_OPTIONS}
          selected={equipment}
          onToggle={(value) =>
            setEquipment((current) => toggle(current, value))
          }
        />
      )}
      {step === 2 && (
        <ChoiceList
          legend="Body areas to avoid"
          options={REGION_OPTIONS}
          selected={avoidRegions}
          onToggle={(value) =>
            setAvoidRegions((current) => toggle(current, value))
          }
        />
      )}
      {step === 3 && (
        <ChoiceList
          legend="Sensory preferences"
          options={[...SENSORY_OPTIONS]}
          selected={sensory}
          onToggle={(value) => setSensory((current) => toggle(current, value))}
        />
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
