import { z } from "zod";

// ---------------------------------------------------------------------------
// Ability profile (Section 4 — profiles.abilities jsonb shape)
// ---------------------------------------------------------------------------

export const PositionSchema = z.enum(["standing", "seated", "lying"]);
export type Position = z.infer<typeof PositionSchema>;

export const EquipmentSchema = z.enum([
  "none",
  "resistance_band",
  "dumbbell",
  "chair",
  "wall",
  "wheelchair",
  "bench",
  "ankle_weights",
  "support_surface",
  "mobility_aid",
  "pool_access",
  "gripper_putty",
]);
export type Equipment = z.infer<typeof EquipmentSchema>;

export const BodyRegionSchema = z.enum([
  "shoulders",
  "arms",
  "core",
  "back",
  "lower_back",
  "hips",
  "legs",
  "neck",
]);
export type BodyRegion = z.infer<typeof BodyRegionSchema>;

export const SensoryPrefsSchema = z.object({
  captions: z.boolean(),
  reduced_motion: z.boolean(),
  haptics: z.boolean(),
});
export type SensoryPrefs = z.infer<typeof SensoryPrefsSchema>;

export const AbilitiesSchema = z.object({
  positions: z.array(PositionSchema),
  equipment: z.array(EquipmentSchema),
  avoid_regions: z.array(BodyRegionSchema),
  sensory: SensoryPrefsSchema,
});
export type Abilities = z.infer<typeof AbilitiesSchema>;

export interface AccessibilityPrefs {
  text_size: "normal" | "large" | "x-large";
  high_contrast: boolean;
  reduced_motion: boolean;
  haptics: boolean;
  speech_enabled: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
  abilities: Abilities;
  prefs: AccessibilityPrefs;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Exercise library (Section 4 — exercises table, seeded/read-only at runtime)
// ---------------------------------------------------------------------------

export interface ExerciseInstructionStep {
  text: string;
  audio_url?: string;
}

export const ExerciseCategorySchema = z.enum([
  "strength",
  "cardio",
  "flexibility",
  "core",
  "balance",
]);
export type ExerciseCategory = z.infer<typeof ExerciseCategorySchema>;

export const TrackingModeSchema = z.enum([
  "camera_manual",
  "timer",
  "manual",
]);
export type TrackingMode = z.infer<typeof TrackingModeSchema>;

export const ExerciseMetricSchema = z.enum([
  "reps",
  "reps_sets_weight",
  "reps_sets",
  "reps_or_time",
  "reps_per_leg",
  "reps_or_hold_time",
  "reps_or_hold_seconds",
  "session_duration",
  "duration_per_stretch",
  "hold_time_sets",
  "duration_effort",
  "distance_time",
  "laps_duration",
  "time_or_reps",
]);
export type ExerciseMetric = z.infer<typeof ExerciseMetricSchema>;

export const ExerciseInteractionGroupSchema = z.enum([
  "counter",
  "timer",
  "manual_entry",
]);
export type ExerciseInteractionGroup = z.infer<
  typeof ExerciseInteractionGroupSchema
>;

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  interaction_group: ExerciseInteractionGroup;
  positions: Position[];
  equipment: Equipment[];
  body_regions: BodyRegion[];
  intensity: 1 | 2 | 3 | 4 | 5;
  tracking_modes: TrackingMode[];
  metric_logged: ExerciseMetric;
  instructions: ExerciseInstructionStep[];
  audio_url: string | null;
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// Daily energy check-in (Section 4 — checkins table)
// ---------------------------------------------------------------------------

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export interface Checkin {
  id: string;
  user_id: string;
  energy: EnergyLevel;
  note: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// AI workout generation contract (Section 5)
// ---------------------------------------------------------------------------

export const WorkoutStepSchema = z.object({
  exercise_id: z.string(),
  duration_seconds: z.number().int().positive(),
  reps: z.number().int().positive().nullable(),
  rest_after_seconds: z.number().int().nonnegative(),
  adaptation_note: z.string(),
});
export type WorkoutStep = z.infer<typeof WorkoutStepSchema>;

export const WorkoutSchema = z.object({
  title: z.string(),
  estimated_minutes: z.number().int().positive(),
  energy_level: z.number().int().min(1).max(5),
  steps: z.array(WorkoutStepSchema).min(1),
});
export type Workout = z.infer<typeof WorkoutSchema>;

export const GenerateWorkoutRequestSchema = z.object({
  profile: z.object({
    abilities: AbilitiesSchema,
  }),
  energy: z.number().int().min(1).max(5),
  recent_session_ids: z.array(z.string()),
});
export type GenerateWorkoutRequest = z.infer<
  typeof GenerateWorkoutRequestSchema
>;

// ---------------------------------------------------------------------------
// Personal range of motion (T08 — calibration, F9)
// ---------------------------------------------------------------------------

/**
 * A user's own comfortable range for the hands-free hero exercise, captured
 * during calibration. Rep counting is scaled to THIS range instead of fixed
 * thresholds, so the app adapts to the body in front of it (never the reverse).
 * Angles are degrees of shoulder abduction; keyed by exercise id in the store.
 */
export interface PersonalRange {
  minDeg: number; // comfortable resting/low angle
  maxDeg: number; // observed comfortable peak; 85% margin applied downstream in rep counting
  capturedAt?: string; // ISO timestamp of calibration (set when captured via T08 flow)
}

// ---------------------------------------------------------------------------
// Workout sessions (Section 4 — sessions table)
// ---------------------------------------------------------------------------

export interface SessionRecord {
  id: string;
  user_id: string;
  workout: Workout;
  completed_steps: number[];
  effort: number | null;
  /** Section 5b: peak range-of-motion angle captured per exercise, keyed by exercise_id */
  peak_rom_degrees?: Record<string, number>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Motion tracking contracts (T07/T03 dependency backbone)
// ---------------------------------------------------------------------------

export interface PoseFrame {
  /** Smoothed joint angle for the active exercise. */
  angleDeg: number;
  /** 0–1 minimum visibility of the required landmarks. */
  visibility: number;
  timestamp: number;
}

export type RepEvent =
  | { type: "rep"; count: number }
  | { type: "range_reached" }
  | { type: "tracking_paused" }
  | { type: "tracking_resumed" };

export interface ExerciseDef {
  // Camera-tracked movements (F9). The torso twist was dropped in favour of the
  // bicep curl: axial rotation is invisible to a single 2D camera as a joint
  // angle, whereas elbow flexion gives a clean, single-limb, mirror-able signal.
  id: "seated_arm_raise" | "seated_bicep_curl";
  name: string;
  landmarks: [number, number, number];
  side: "left" | "right" | "either";
  instructions: string[];
  cues: { rangeReached: string; encourage: string[] };
}

export interface PoseProvider {
  start(video: HTMLVideoElement, ex: ExerciseDef): void;
  stop(): void;
  onFrame(cb: (f: PoseFrame) => void): void;
  onRepEvent(cb: (e: RepEvent) => void): void;
  setRange(r: PersonalRange): void;
}

export interface SafeMovementStats {
  repsInTargetRange: number;
  movementConsistencyPercent: number | null;
  averageRepSeconds: number | null;
  activeSeconds: number;
  restSeconds: number;
}

export interface SpeakOptions {
  /** Cancel queued or active speech before speaking this utterance. */
  interrupt?: boolean;
}

/**
 * Section 0 contract: summary of one completed tracking session, consumed by
 * the /summary screen (T12). Distinct from WorkoutSessionSummary below.
 */
export interface SessionSummary {
  exerciseId: string;
  reps: number;
  personalRange: PersonalRange;
  peakAngleToday: number;
  safeStats?: SafeMovementStats;
  startedAt: number;
  endedAt: number;
}

/**
 * Locally persisted summary of a finished workout, powering the progress
 * view (F6) with or without a Supabase login. Effort and showing up only —
 * never calories or steps. (Renamed from SessionSummary so the Section 0
 * contract keeps its agreed name.)
 */
export interface WorkoutSessionSummary {
  id: string;
  workout_title: string;
  energy_level: EnergyLevel;
  completed_steps: number;
  total_steps: number;
  effort: number | null;
  peak_rom_degrees: Record<string, number>;
  completed_at: string;
}
