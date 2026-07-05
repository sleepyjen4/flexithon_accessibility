import type {
  Abilities,
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseInteractionGroup,
  ExerciseMetric,
  Position,
  TrackingMode,
  Workout,
  WorkoutStep,
} from "@/types";

type ExerciseSeed = Omit<
  Exercise,
  "category" | "interaction_group" | "tracking_modes" | "metric_logged"
> &
  Partial<
    Pick<
      Exercise,
      "category" | "interaction_group" | "tracking_modes" | "metric_logged"
    >
  >;

const DEFAULT_EXERCISE_METADATA: Pick<
  Exercise,
  "category" | "interaction_group" | "tracking_modes" | "metric_logged"
> = {
  category: "strength",
  interaction_group: "counter",
  tracking_modes: ["manual"],
  metric_logged: "reps_sets",
};

function defineExercise(seed: ExerciseSeed): Exercise {
  const trackingModes =
    seed.tracking_modes ?? DEFAULT_EXERCISE_METADATA.tracking_modes;
  const metricLogged = seed.metric_logged ?? DEFAULT_EXERCISE_METADATA.metric_logged;
  const inferredInteractionGroup: ExerciseInteractionGroup =
    metricLogged === "distance_time" || metricLogged === "laps_duration"
      ? "manual_entry"
      : trackingModes.includes("timer")
        ? "timer"
        : "counter";

  return {
    ...DEFAULT_EXERCISE_METADATA,
    ...seed,
    interaction_group: seed.interaction_group ?? inferredInteractionGroup,
  };
}

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: "Strength",
  cardio: "Cardio",
  flexibility: "Flexibility",
  core: "Core",
  balance: "Balance",
};

export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  camera_manual: "Camera + manual",
  timer: "Timer",
  manual: "Manual",
};

export const EXERCISE_METRIC_LABELS: Record<ExerciseMetric, string> = {
  reps: "Reps",
  reps_sets_weight: "Reps x sets, weight",
  reps_sets: "Reps x sets",
  reps_or_time: "Reps or time",
  reps_per_leg: "Reps per leg",
  reps_or_hold_time: "Reps or hold time",
  reps_or_hold_seconds: "Reps or hold seconds",
  session_duration: "Session duration",
  duration_per_stretch: "Duration per stretch",
  hold_time_sets: "Hold time x sets",
  duration_effort: "Duration, effort",
  distance_time: "Distance, time",
  laps_duration: "Laps, duration",
  time_or_reps: "Time or reps",
};

export const EXERCISE_INTERACTION_GROUP_LABELS: Record<
  ExerciseInteractionGroup,
  string
> = {
  counter: "Rep/set counter",
  timer: "Built-in timer",
  manual_entry: "Manual entry",
};

export const EXERCISE_INTERACTION_GROUP_DESCRIPTIONS: Record<
  ExerciseInteractionGroup,
  string
> = {
  counter: "Simple counter controls for reps, sets, holds, or optional weight.",
  timer: "Timer-first activities for sessions, holds, stretches, or effort logs.",
  manual_entry: "Logged after the activity with distance, time, laps, or notes.",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: "None",
  resistance_band: "Resistance band",
  dumbbell: "Dumbbells",
  chair: "Chair",
  wall: "Wall",
  wheelchair: "Wheelchair",
  bench: "Bench",
  ankle_weights: "Ankle weights",
  support_surface: "Support surface",
  mobility_aid: "Mobility aid",
  pool_access: "Pool access",
  gripper_putty: "Gripper or putty",
};

export const POSITION_LABELS: Record<Position, string> = {
  seated: "Seated",
  standing: "Standing",
  lying: "Lying",
};

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
const SEEDED_EXERCISES: ExerciseSeed[] = [
  {
    id: "seated_band_row",
    name: "Seated Resistance Band Row",
    description: "A seated pulling motion that can be counted from elbow travel.",
    category: "strength",
    interaction_group: "counter",
    positions: ["seated"],
    equipment: ["resistance_band"],
    body_regions: ["back", "shoulders", "arms"],
    intensity: 2,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_sets",
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
    category: "strength",
    positions: ["seated"],
    equipment: ["none", "dumbbell"],
    body_regions: ["shoulders"],
    intensity: 2,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_sets_weight",
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
    category: "flexibility",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["hips", "lower_back"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    name: "Seated Marching",
    description: "A seated cardio move that can be counted from knee lift height.",
    category: "cardio",
    interaction_group: "counter",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["core", "legs"],
    intensity: 2,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_or_time",
    instructions: [
      { text: "Sit tall at the front of a sturdy chair." },
      { text: "Lift one knee, then lower; alternate sides." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "wall_pushup",
    name: "Wall or Incline Push-Up",
    description: "A supported push movement that can be counted from elbow angle.",
    category: "strength",
    interaction_group: "counter",
    positions: ["standing"],
    equipment: ["wall", "bench"],
    body_regions: ["arms", "shoulders", "core"],
    intensity: 3,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_sets",
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
    name: "Chair Pilates / Core Rotations",
    description: "A chair-based core rotation sequence that can use a timer or reps.",
    category: "core",
    interaction_group: "timer",
    positions: ["seated"],
    equipment: ["none"],
    body_regions: ["core", "back"],
    intensity: 2,
    tracking_modes: ["timer"],
    metric_logged: "time_or_reps",
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
    category: "strength",
    positions: ["lying"],
    equipment: ["resistance_band"],
    body_regions: ["arms", "shoulders"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
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
    category: "flexibility",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["legs"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "flexibility",
    positions: ["seated", "standing"],
    equipment: ["none"],
    body_regions: ["shoulders", "neck"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "reps_or_hold_seconds",
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
    category: "flexibility",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["neck"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "flexibility",
    positions: ["seated", "standing"],
    equipment: ["none"],
    body_regions: ["shoulders", "arms"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "flexibility",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["arms"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "strength",
    interaction_group: "counter",
    positions: ["seated"],
    equipment: ["dumbbell", "resistance_band"],
    body_regions: ["arms"],
    intensity: 2,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_sets_weight",
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
    name: "Seated Shoulder Press",
    description: "A seated press that can be counted from wrist height rising and lowering.",
    category: "strength",
    interaction_group: "counter",
    positions: ["seated"],
    equipment: ["dumbbell", "none"],
    body_regions: ["shoulders", "arms"],
    intensity: 3,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_sets_weight",
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
    category: "strength",
    positions: ["seated", "standing"],
    equipment: ["resistance_band"],
    body_regions: ["shoulders", "back"],
    intensity: 2,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
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
    category: "strength",
    positions: ["seated"],
    equipment: ["resistance_band"],
    body_regions: ["arms", "shoulders"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
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
    category: "strength",
    positions: ["seated"],
    equipment: ["resistance_band"],
    body_regions: ["back", "shoulders"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
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
    category: "flexibility",
    positions: ["seated", "standing"],
    equipment: ["none"],
    body_regions: ["core"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "cardio",
    positions: ["seated", "standing"],
    equipment: ["none", "dumbbell"],
    body_regions: ["arms", "shoulders", "core"],
    intensity: 4,
    tracking_modes: ["timer"],
    metric_logged: "reps_or_time",
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
    name: "Seated Leg Extension",
    description: "Strengthens the front of the thighs and can be counted from knee angle.",
    category: "strength",
    interaction_group: "counter",
    positions: ["seated"],
    equipment: ["chair", "none", "ankle_weights"],
    body_regions: ["legs"],
    intensity: 2,
    tracking_modes: ["camera_manual"],
    metric_logged: "reps_per_leg",
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
    category: "strength",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["legs"],
    intensity: 1,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
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
    category: "flexibility",
    positions: ["seated"],
    equipment: ["chair", "none"],
    body_regions: ["back", "hips"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "strength",
    positions: ["seated", "standing"],
    equipment: ["resistance_band"],
    body_regions: ["shoulders"],
    intensity: 2,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
    instructions: [
      { text: "Hold the band with both hands, elbows bent at your sides." },
      { text: "Keep elbows tucked and rotate your hands outward." },
      { text: "Return slowly to the start." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "isometric_glute_contraction",
    name: "Isometric Glute Contraction",
    description: "Strengthens the glutes with a still squeeze-and-hold, no movement needed.",
    category: "strength",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["hips"],
    intensity: 2,
    tracking_modes: ["timer"],
    metric_logged: "hold_time_sets",
    instructions: [
      { text: "Settle into a comfortable, supported seated or lying position." },
      { text: "Squeeze your glutes firmly together, breathing steadily." },
      { text: "Hold the squeeze, then release slowly and rest." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "lying_side_leg_lift",
    name: "Lying Side Leg Lift",
    description: "Works the outer hips while fully supported.",
    category: "strength",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["hips", "legs"],
    intensity: 2,
    tracking_modes: ["manual"],
    metric_logged: "reps_per_leg",
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
    category: "flexibility",
    positions: ["lying"],
    equipment: ["none", "dumbbell"],
    body_regions: ["shoulders", "arms"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "reps_or_time",
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
    category: "strength",
    positions: ["lying"],
    equipment: ["resistance_band"],
    body_regions: ["legs", "hips"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "reps_per_leg",
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
    category: "core",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["core", "lower_back"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "time_or_reps",
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
    category: "flexibility",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["shoulders", "back"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "flexibility",
    positions: ["lying"],
    equipment: ["none"],
    body_regions: ["legs", "hips"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "reps_or_time",
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
    category: "strength",
    positions: ["standing", "seated"],
    equipment: ["chair"],
    body_regions: ["legs", "hips"],
    intensity: 4,
    tracking_modes: ["manual"],
    metric_logged: "reps_sets",
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
    category: "flexibility",
    positions: ["standing"],
    equipment: ["wall"],
    body_regions: ["legs"],
    intensity: 2,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
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
    category: "strength",
    positions: ["standing"],
    equipment: ["chair"],
    body_regions: ["hips", "legs"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "reps_per_leg",
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
    category: "cardio",
    positions: ["standing"],
    equipment: ["none", "chair"],
    body_regions: ["legs", "core"],
    intensity: 3,
    tracking_modes: ["timer"],
    metric_logged: "reps_or_time",
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
    category: "flexibility",
    positions: ["standing"],
    equipment: ["wall"],
    body_regions: ["shoulders", "back"],
    intensity: 2,
    tracking_modes: ["timer"],
    metric_logged: "reps_or_time",
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
    category: "flexibility",
    positions: ["seated", "lying"],
    equipment: ["none"],
    body_regions: ["core"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "session_duration",
    instructions: [
      { text: "Sit or lie comfortably, one hand on your belly if you like." },
      { text: "Breathe in slowly through your nose for a count of four." },
      { text: "Breathe out even more slowly. Repeat." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "wheelchair_pushups",
    name: "Wheelchair Push-Ups",
    description: "A seated pressure-relief strength option using a wheelchair.",
    category: "strength",
    interaction_group: "counter",
    positions: ["seated"],
    equipment: ["wheelchair"],
    body_regions: ["arms", "shoulders"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "reps",
    instructions: [
      { text: "Place hands on the armrests or wheels in a stable position." },
      { text: "Press down to lift or unweight as much as feels comfortable." },
      { text: "Hold briefly or lower right away, then rest." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "grip_strengthening",
    name: "Grip Strengthening",
    description: "Hand and forearm work using a gripper or therapy putty.",
    category: "strength",
    interaction_group: "counter",
    positions: ["seated", "standing", "lying"],
    equipment: ["gripper_putty"],
    body_regions: ["arms"],
    intensity: 1,
    tracking_modes: ["manual"],
    metric_logged: "reps_or_hold_seconds",
    instructions: [
      { text: "Hold the gripper or putty in one hand." },
      { text: "Squeeze or press with steady effort." },
      { text: "Release slowly, resting whenever you want." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_adaptive_yoga",
    name: "Seated Adaptive Yoga",
    description: "A gentle seated or lying mobility sequence.",
    category: "flexibility",
    interaction_group: "timer",
    positions: ["seated", "lying"],
    equipment: ["none", "chair"],
    body_regions: ["neck", "shoulders", "back", "hips"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "session_duration",
    instructions: [
      { text: "Settle into a supported seated or lying position." },
      { text: "Move through slow reaches, folds, or twists that feel available." },
      { text: "Pause as often as you need." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "stretching_routine",
    name: "Stretching Routine",
    description: "A short full-body stretch sequence with flexible positioning.",
    category: "flexibility",
    interaction_group: "timer",
    positions: ["seated", "standing", "lying"],
    equipment: ["none"],
    body_regions: ["neck", "shoulders", "back", "hips", "legs"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "duration_per_stretch",
    instructions: [
      { text: "Choose a supported position." },
      { text: "Move into each stretch gradually." },
      { text: "Hold while it feels useful, then change sides or rest." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "seated_tai_chi",
    name: "Seated Tai Chi",
    description: "Slow seated flow for balance, breath, and upper-body mobility.",
    category: "balance",
    interaction_group: "timer",
    positions: ["seated"],
    equipment: ["none", "chair"],
    body_regions: ["shoulders", "arms", "core"],
    intensity: 1,
    tracking_modes: ["timer"],
    metric_logged: "session_duration",
    instructions: [
      { text: "Sit in a supported position with relaxed shoulders." },
      { text: "Move your arms slowly through soft circles or reaches." },
      { text: "Keep the pace calm and take breaks whenever you want." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "supported_weight_shifts",
    name: "Balance Training",
    description: "Supported weight shifts or standing holds with a stable surface.",
    category: "balance",
    interaction_group: "timer",
    positions: ["seated", "standing"],
    equipment: ["support_surface"],
    body_regions: ["core", "hips", "legs"],
    intensity: 2,
    tracking_modes: ["camera_manual", "timer"],
    metric_logged: "hold_time_sets",
    instructions: [
      { text: "Set up with a stable surface within reach." },
      { text: "Hold steady or shift weight gently side to side." },
      { text: "Return to center and rest between rounds." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "wheelchair_seated_dance",
    name: "Wheelchair or Seated Dance",
    description: "A seated cardio session built around rhythm and effort.",
    category: "cardio",
    interaction_group: "timer",
    positions: ["seated"],
    equipment: ["none", "wheelchair", "chair"],
    body_regions: ["arms", "shoulders", "core"],
    intensity: 3,
    tracking_modes: ["timer"],
    metric_logged: "duration_effort",
    instructions: [
      { text: "Choose music or a rhythm that feels good today." },
      { text: "Move arms, shoulders, or torso in any pattern that fits." },
      { text: "Slow down, pause, or switch movements whenever you want." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "wheelchair_pushing",
    name: "Wheelchair Pushing",
    description: "A manual wheelchair cardio option logged by distance or time.",
    category: "cardio",
    interaction_group: "manual_entry",
    positions: ["seated"],
    equipment: ["wheelchair"],
    body_regions: ["arms", "shoulders", "core"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "distance_time",
    instructions: [
      { text: "Pick a clear route or stay in one safe area." },
      { text: "Push at a pace that matches your energy." },
      { text: "Stop and rest whenever you need." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "walking_mobility_aids",
    name: "Walking With Mobility Aids",
    description: "A standing cardio option for cane, walker, or prosthesis users.",
    category: "cardio",
    interaction_group: "manual_entry",
    positions: ["standing"],
    equipment: ["mobility_aid"],
    body_regions: ["legs", "hips", "core"],
    intensity: 3,
    tracking_modes: ["manual"],
    metric_logged: "distance_time",
    instructions: [
      { text: "Use the mobility aid setup that already works for you." },
      { text: "Walk for a short time or distance." },
      { text: "Pause, turn, or finish whenever your body asks." },
    ],
    audio_url: null,
    image_url: null,
  },
  {
    id: "swimming",
    name: "Swimming",
    description: "A pool-access cardio option logged by laps or duration.",
    category: "cardio",
    interaction_group: "manual_entry",
    positions: ["standing"],
    equipment: ["pool_access"],
    body_regions: ["arms", "shoulders", "core", "hips", "legs"],
    intensity: 4,
    tracking_modes: ["manual"],
    metric_logged: "laps_duration",
    instructions: [
      { text: "Use the pool entry and stroke pattern that fit you." },
      { text: "Swim, walk, or move in the water at a sustainable pace." },
      { text: "Log laps or duration after the session." },
    ],
    audio_url: null,
    image_url: null,
  },
];

export const EXERCISES: Exercise[] = SEEDED_EXERCISES.map(defineExercise);

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}

export function groupExercisesByCategory(
  exercises: Exercise[],
): Record<ExerciseCategory, Exercise[]> {
  return exercises.reduce<Record<ExerciseCategory, Exercise[]>>(
    (groups, exercise) => {
      groups[exercise.category].push(exercise);
      return groups;
    },
    {
      strength: [],
      cardio: [],
      flexibility: [],
      core: [],
      balance: [],
    },
  );
}

export function groupExercisesByInteraction(
  exercises: Exercise[],
): Record<ExerciseInteractionGroup, Exercise[]> {
  return exercises.reduce<Record<ExerciseInteractionGroup, Exercise[]>>(
    (groups, exercise) => {
      groups[exercise.interaction_group].push(exercise);
      return groups;
    },
    {
      counter: [],
      timer: [],
      manual_entry: [],
    },
  );
}

export function exerciseForWorkoutPrompt(exercise: Exercise) {
  return {
    exercise_id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    interaction_group: exercise.interaction_group,
    positions: exercise.positions,
    equipment: exercise.equipment,
    body_regions: exercise.body_regions,
    intensity: exercise.intensity,
    tracking_modes: exercise.tracking_modes,
    metric_logged: exercise.metric_logged,
  };
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
