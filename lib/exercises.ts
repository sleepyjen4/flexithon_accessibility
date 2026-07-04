import type { Abilities, Exercise } from "@/types";

/**
 * Seed exercise library (Section 1.5, F2). Hand-written starter set —
 * content team (Block D) expands this to ~30 covering every
 * position/equipment/body-region combination before demo day.
 */
export const EXERCISES: Exercise[] = [
  {
    id: "seated_band_row",
    name: "Seated Band Row",
    description: "A gentle pulling motion to strengthen the upper back.",
    positions: ["seated"],
    equipment: ["resistance_band"],
    body_regions: ["back", "shoulders", "arms"],
    intensity: 2,
    instructions: [
      { text: "Anchor the band at chest height in front of you." },
      { text: "Sit tall, hold one end in each hand." },
      { text: "Pull elbows back, squeezing shoulder blades together." },
      { text: "Release slowly and repeat." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_lateral_raise",
    name: "Seated Lateral Raise",
    description: "Hero exercise for hands-free rep counting (Section 5b).",
    positions: ["seated"],
    equipment: ["none", "dumbbell"],
    body_regions: ["shoulders"],
    intensity: 2,
    instructions: [
      { text: "Sit tall with arms relaxed at your sides." },
      { text: "Raise both arms out to the sides to shoulder height." },
      { text: "Lower slowly with control." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_knee_to_chest",
    name: "Lying Knee-to-Chest Stretch",
    description: "A low-intensity stretch for the hips and lower back.",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["hips", "lower_back"],
    intensity: 1,
    instructions: [
      { text: "Lie on your back, knees bent, feet flat." },
      { text: "Bring one knee gently toward your chest." },
      { text: "Hold, then switch sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_march",
    name: "Seated March",
    description: "A light warm-up to get the legs and core moving.",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["core", "legs"],
    intensity: 2,
    instructions: [
      { text: "Sit tall at the front of a sturdy chair." },
      { text: "Lift one knee, then lower; alternate sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "wall_pushup",
    name: "Wall Push-Up",
    description: "A standing, wall-supported push movement for the chest and arms.",
    positions: ["standing"],
    equipment: ["wall"],
    body_regions: ["arms", "shoulders", "core"],
    intensity: 3,
    instructions: [
      { text: "Stand facing a wall, arm's length away." },
      { text: "Place palms on the wall at shoulder height." },
      { text: "Bend elbows to bring chest toward the wall, then push back." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_torso_twist",
    name: "Seated Torso Twist",
    description: "A gentle rotation to mobilize the spine and core.",
    positions: ["seated"],
    equipment: ["none"],
    body_regions: ["core", "back"],
    intensity: 2,
    instructions: [
      { text: "Sit tall, feet flat on the floor." },
      { text: "Cross arms over your chest." },
      { text: "Rotate your torso gently side to side." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_band_chest_press",
    name: "Lying Band Chest Press",
    description: "A supported pressing motion for the chest and arms.",
    positions: ["lying"],
    equipment: ["resistance_band"],
    body_regions: ["arms", "shoulders"],
    intensity: 3,
    instructions: [
      { text: "Lie on your back, band anchored behind you." },
      { text: "Hold one end in each hand at chest level." },
      { text: "Press hands up and forward, then return slowly." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_ankle_circles",
    name: "Seated Ankle Circles",
    description: "A very low-intensity mobility exercise for the ankles.",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["legs"],
    intensity: 1,
    instructions: [
      { text: "Lift one foot slightly off the floor." },
      { text: "Rotate the ankle slowly in circles, then switch direction." },
    ],
    audio_url: null,
    image_url: null,
  },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}

/** Exercises usable given a profile's positions/equipment, excluding avoided body regions. */
export function filterExercisesForAbilities(
  abilities: Abilities,
  exercises: Exercise[] = EXERCISES,
): Exercise[] {
  return exercises.filter((exercise) => {
    const positionMatch = exercise.positions.some((position) =>
      abilities.positions.includes(position),
    );
    const equipmentMatch = exercise.equipment.some((item) =>
      abilities.equipment.includes(item),
    );
    const avoidsRegion = exercise.body_regions.some((region) =>
      abilities.avoid_regions.includes(region),
    );

    return positionMatch && equipmentMatch && !avoidsRegion;
  });
}

/** Energy 1-2 -> fewer, gentler steps; energy 4-5 -> more, harder steps (Section 5). */
export function stepCountForEnergy(energy: number): number {
  if (energy <= 2) return 4;
  if (energy === 3) return 5;
  return 6;
}
