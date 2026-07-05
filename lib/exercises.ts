import type { Abilities, Exercise, Workout, WorkoutStep } from "@/types";

/**
 * The one exercise wired for hands-free camera rep-counting (Section 5b).
 * Workouts should include it whenever it's available for the user's
 * abilities so the player's camera-tracking UI has a chance to appear.
 */
export const HERO_EXERCISE_ID = "seated_lateral_raise";

/**
 * Seed exercise library (Section 1.5, F2). ~30 hand-written exercises
 * covering every position/equipment/body-region combination; every
 * movement pattern has a seated or lying variant.
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
    description: "Hero exercise for hands-free rep counting.",
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
  {
    id: "seated_shoulder_shrugs",
    name: "Seated Shoulder Shrugs",
    description: "A gentle release for tension in the shoulders and neck.",
    positions: ["seated", "standing"],
    equipment: ["none"],
    body_regions: ["shoulders", "neck"],
    intensity: 1,
    instructions: [
      { text: "Sit tall with arms relaxed at your sides." },
      { text: "Lift both shoulders up toward your ears." },
      { text: "Hold for a breath, then let them drop with a sigh." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_neck_stretch",
    name: "Seated Neck Stretch",
    description: "A slow side-to-side stretch for the neck.",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["neck"],
    intensity: 1,
    instructions: [
      { text: "Sit or lie comfortably with shoulders relaxed." },
      { text: "Tilt one ear gently toward the same-side shoulder." },
      { text: "Hold for a few breaths, then switch sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_arm_circles",
    name: "Seated Arm Circles",
    description: "A light warm-up that gets blood flowing to the shoulders.",
    positions: ["seated", "standing"],
    equipment: ["none"],
    body_regions: ["shoulders", "arms"],
    intensity: 1,
    instructions: [
      { text: "Extend your arms out to the sides, or keep them bent — both work." },
      { text: "Draw small circles forward, growing them gradually." },
      { text: "Reverse direction halfway through." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_wrist_rolls",
    name: "Seated Wrist and Hand Rolls",
    description: "Gentle mobility for wrists and hands.",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["arms"],
    intensity: 1,
    instructions: [
      { text: "Rest your elbows at your sides or on an armrest." },
      { text: "Roll your wrists slowly in circles." },
      { text: "Open and close your hands a few times to finish." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_bicep_curl",
    name: "Seated Bicep Curl",
    description: "A classic arm strengthener, seated and supported.",
    positions: ["seated"],
    equipment: ["dumbbell", "resistance_band"],
    body_regions: ["arms"],
    intensity: 2,
    instructions: [
      { text: "Hold a weight or band end in one or both hands, palms up." },
      { text: "Curl your hands toward your shoulders." },
      { text: "Lower slowly with control." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_overhead_press",
    name: "Seated Overhead Press",
    description: "A pressing motion that builds shoulder and arm strength.",
    positions: ["seated"],
    equipment: ["dumbbell", "none"],
    body_regions: ["shoulders", "arms"],
    intensity: 3,
    instructions: [
      { text: "Start with hands at shoulder height, palms facing forward." },
      { text: "Press up toward the ceiling as far as feels comfortable." },
      { text: "Lower back to shoulder height with control." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_band_pull_apart",
    name: "Seated Band Pull-Apart",
    description: "Strengthens the upper back and opens the chest.",
    positions: ["seated", "standing"],
    equipment: ["resistance_band"],
    body_regions: ["shoulders", "back"],
    intensity: 2,
    instructions: [
      { text: "Hold the band with both hands at chest height, arms forward." },
      { text: "Pull your hands apart, squeezing your shoulder blades." },
      { text: "Return slowly to the start." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_band_chest_press",
    name: "Seated Band Chest Press",
    description: "A seated pressing motion for the chest and arms.",
    positions: ["seated"],
    equipment: ["resistance_band"],
    body_regions: ["arms", "shoulders"],
    intensity: 3,
    instructions: [
      { text: "Loop the band behind your chair back or your own back." },
      { text: "Hold one end in each hand at chest level." },
      { text: "Press forward until arms are extended, then return slowly." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_band_overhead_pull",
    name: "Seated Band Overhead Pull-Down",
    description: "A pulling motion for the upper back and shoulders.",
    positions: ["seated"],
    equipment: ["resistance_band"],
    body_regions: ["back", "shoulders"],
    intensity: 3,
    instructions: [
      { text: "Hold the band overhead with both hands, a little wider than shoulders." },
      { text: "Pull your elbows down and out to the sides." },
      { text: "Return overhead with control." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_side_bend",
    name: "Seated Side Bend",
    description: "A gentle stretch along the sides of the torso.",
    positions: ["seated", "standing"],
    equipment: ["none"],
    body_regions: ["core"],
    intensity: 1,
    instructions: [
      { text: "Sit tall and reach one arm up or rest it on your head." },
      { text: "Lean gently to the opposite side." },
      { text: "Come back to center and switch sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_boxer_punches",
    name: "Seated Boxer Punches",
    description: "A lively cardio move — punch the air at your own pace.",
    positions: ["seated", "standing"],
    equipment: ["none", "dumbbell"],
    body_regions: ["arms", "shoulders", "core"],
    intensity: 4,
    instructions: [
      { text: "Sit tall with fists at chest height." },
      { text: "Punch forward, alternating arms, rotating slightly through the torso." },
      { text: "Pick a rhythm that feels strong but sustainable." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_knee_extension",
    name: "Seated Knee Extension",
    description: "Strengthens the front of the thighs from a chair.",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["legs"],
    intensity: 2,
    instructions: [
      { text: "Sit tall with feet flat on the floor." },
      { text: "Straighten one knee, lifting the foot forward." },
      { text: "Lower slowly, then switch legs." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_heel_raises",
    name: "Seated Heel Raises",
    description: "A low-intensity move for calves and circulation.",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["legs"],
    intensity: 1,
    instructions: [
      { text: "Sit with feet flat on the floor." },
      { text: "Lift both heels, pressing through the balls of your feet." },
      { text: "Lower back down slowly." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_forward_fold",
    name: "Seated Forward Fold",
    description: "A relaxing stretch for the back and hips.",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["back", "hips"],
    intensity: 1,
    instructions: [
      { text: "Sit toward the front of your seat, feet apart." },
      { text: "Fold forward slowly, letting arms and head hang heavy." },
      { text: "Roll back up one vertebra at a time." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_band_shoulder_rotation",
    name: "Seated Band Shoulder Rotation",
    description: "External rotation to support healthy shoulders.",
    positions: ["seated", "standing"],
    equipment: ["resistance_band"],
    body_regions: ["shoulders"],
    intensity: 2,
    instructions: [
      { text: "Hold the band with both hands, elbows bent at your sides." },
      { text: "Keep elbows tucked and rotate your hands outward." },
      { text: "Return slowly to the start." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_glute_bridge",
    name: "Lying Glute Bridge",
    description: "Strengthens the hips from a supported lying position.",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["hips", "core"],
    intensity: 3,
    instructions: [
      { text: "Lie on your back, knees bent, feet flat and hip-width apart." },
      { text: "Press through your feet to lift your hips." },
      { text: "Lower back down slowly." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_side_leg_lift",
    name: "Lying Side Leg Lift",
    description: "Works the outer hips while fully supported.",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["hips", "legs"],
    intensity: 2,
    instructions: [
      { text: "Lie on your side with legs stacked, head supported." },
      { text: "Lift the top leg a comfortable distance." },
      { text: "Lower with control; switch sides halfway." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_arm_reach_cross",
    name: "Lying Arm Reaches",
    description: "Gentle shoulder movement with full back support.",
    positions: ["lying"],
    equipment: ["none", "dumbbell"],
    body_regions: ["shoulders", "arms"],
    intensity: 1,
    instructions: [
      { text: "Lie on your back with arms resting at your sides." },
      { text: "Reach both arms up toward the ceiling." },
      { text: "Lower them slowly overhead or back to your sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_band_leg_press",
    name: "Lying Band Leg Press",
    description: "A supported pressing motion for the legs.",
    positions: ["lying"],
    equipment: ["resistance_band"],
    body_regions: ["legs", "hips"],
    intensity: 3,
    instructions: [
      { text: "Lie on your back and loop the band around one foot." },
      { text: "Hold the ends and press that foot away from you." },
      { text: "Bend the knee back slowly; switch legs halfway." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_pelvic_tilt",
    name: "Lying Pelvic Tilt",
    description: "A subtle core activator that's gentle on the back.",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["core", "lower_back"],
    intensity: 1,
    instructions: [
      { text: "Lie on your back, knees bent, feet flat." },
      { text: "Gently flatten your lower back toward the floor." },
      { text: "Release and repeat in a slow rhythm." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_chest_opener",
    name: "Lying Chest Opener",
    description: "A restful stretch that opens the chest and shoulders.",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["shoulders", "back"],
    intensity: 1,
    instructions: [
      { text: "Lie on your back with knees bent." },
      { text: "Stretch your arms out to the sides like a T." },
      { text: "Breathe slowly and let your shoulders sink down." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_heel_slides",
    name: "Lying Heel Slides",
    description: "Gentle leg movement with the floor doing the supporting.",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["legs", "hips"],
    intensity: 1,
    instructions: [
      { text: "Lie on your back with legs extended." },
      { text: "Slide one heel toward your body, bending the knee." },
      { text: "Slide it back out; alternate sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "standing_chair_squat",
    name: "Sit-to-Stand",
    description: "A functional strength move using a sturdy chair.",
    positions: ["standing", "seated"],
    equipment: ["chair"],
    body_regions: ["legs", "hips"],
    intensity: 4,
    instructions: [
      { text: "Sit toward the front of a sturdy chair, feet under knees." },
      { text: "Lean forward and press up to standing — use armrests if helpful." },
      { text: "Lower back down slowly with control." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "standing_wall_lean_calf",
    name: "Wall Calf Stretch",
    description: "A supported standing stretch for the calves.",
    positions: ["standing"],
    equipment: ["wall"],
    body_regions: ["legs"],
    intensity: 2,
    instructions: [
      { text: "Stand facing a wall with hands on it for support." },
      { text: "Step one foot back, keeping that heel down." },
      { text: "Lean gently forward, then switch legs." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "standing_side_leg_raise",
    name: "Standing Side Leg Raise",
    description: "Hip strength with a chair for balance support.",
    positions: ["standing"],
    equipment: ["chair"],
    body_regions: ["hips", "legs"],
    intensity: 3,
    instructions: [
      { text: "Stand behind a chair, holding the back for support." },
      { text: "Lift one leg out to the side, keeping your torso tall." },
      { text: "Lower with control; switch sides halfway." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "standing_march",
    name: "Standing March",
    description: "A steady-paced march to raise your heart rate.",
    positions: ["standing"],
    equipment: ["none", "chair"],
    body_regions: ["legs", "core"],
    intensity: 3,
    instructions: [
      { text: "Stand tall, holding a chair back if you'd like support." },
      { text: "March in place, lifting knees to a comfortable height." },
      { text: "Swing your arms if that feels good." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "standing_wall_slide",
    name: "Wall Arm Slides",
    description: "Shoulder mobility with the wall guiding the movement.",
    positions: ["standing"],
    equipment: ["wall"],
    body_regions: ["shoulders", "back"],
    intensity: 2,
    instructions: [
      { text: "Stand with your back against a wall, arms in a goalpost shape." },
      { text: "Slide your arms up the wall as far as comfortable." },
      { text: "Slide back down slowly." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_deep_breathing",
    name: "Seated Deep Breathing",
    description: "A calm finisher — slow breaths to wind down.",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["core"],
    intensity: 1,
    instructions: [
      { text: "Sit or lie comfortably, one hand on your belly if you like." },
      { text: "Breathe in slowly through your nose for a count of four." },
      { text: "Breathe out even more slowly. Repeat." },
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

/**
 * Gentlest-first selection for the deterministic fallback (Section 5). Sorting
 * by intensity alone can crowd HERO_EXERCISE_ID out entirely — there are more
 * intensity-1 stretches in the library than most step budgets — so once the
 * intensity sort picks its N, swap it in if it was left out and is available.
 */
export function pickExercisesForEnergy(
  candidates: Exercise[],
  stepCount: number,
): Exercise[] {
  const sorted = [...candidates].sort((a, b) => a.intensity - b.intensity);
  const chosen = sorted.slice(0, stepCount);

  const hero = candidates.find((exercise) => exercise.id === HERO_EXERCISE_ID);
  if (
    hero &&
    chosen.length > 0 &&
    !chosen.some((exercise) => exercise.id === HERO_EXERCISE_ID)
  ) {
    chosen[chosen.length - 1] = hero;
  }

  return chosen;
}

/**
 * Guarantees HERO_EXERCISE_ID appears in a generated workout's steps when it's
 * available for the user's abilities, regardless of what produced the workout
 * (LLM or fallback) — Section 5b requires it to reliably appear so the
 * camera-tracking demo has a step to attach to.
 */
export function ensureHeroExerciseStep(
  workout: Workout,
  availableExercises: Exercise[],
  energy: number,
): Workout {
  const hero = availableExercises.find((exercise) => exercise.id === HERO_EXERCISE_ID);
  if (!hero || workout.steps.length === 0) return workout;
  if (workout.steps.some((step) => step.exercise_id === HERO_EXERCISE_ID)) return workout;

  const heroStep: WorkoutStep = {
    exercise_id: hero.id,
    duration_seconds: energy <= 2 ? 30 : 45,
    reps: null,
    rest_after_seconds: energy <= 2 ? 60 : 30,
    adaptation_note: "Go at your own pace — skipping is always okay.",
  };

  const steps = [...workout.steps];
  steps[steps.length - 1] = heroStep;
  return { ...workout, steps };
}
