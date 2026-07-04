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

export interface Exercise {
  id: string;
  name: string;
  description: string;
  positions: Position[];
  equipment: Equipment[];
  body_regions: BodyRegion[];
  intensity: 1 | 2 | 3 | 4 | 5;
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
  maxDeg: number; // comfortable peak angle (already inside the comfort margin)
  capturedAt: string; // ISO timestamp of calibration
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

/**
 * Locally persisted summary of a finished session, powering the progress
 * view (F6) with or without a Supabase login. Effort and showing up only —
 * never calories or steps.
 */
export interface SessionSummary {
  id: string;
  workout_title: string;
  energy_level: EnergyLevel;
  completed_steps: number;
  total_steps: number;
  effort: number | null;
  peak_rom_degrees: Record<string, number>;
  completed_at: string;
}
