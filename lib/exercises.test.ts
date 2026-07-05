import { describe, expect, it } from "vitest";
import {
  EXERCISES,
  getExerciseById,
  exerciseForWorkoutPrompt,
  filterExercisesForAbilities,
  groupExercisesByCategory,
  groupExercisesByInteraction,
} from "@/lib/exercises";
import {
  ExerciseCategorySchema,
  ExerciseInteractionGroupSchema,
  ExerciseMetricSchema,
  TrackingModeSchema,
  type Abilities,
} from "@/types";

const BASE_SENSORY = {
  captions: true,
  reduced_motion: false,
  haptics: false,
};

describe("T22 exercise metadata", () => {
  it("defines strict dashboard and generator metadata for every exercise", () => {
    for (const exercise of EXERCISES) {
      expect(ExerciseCategorySchema.safeParse(exercise.category).success).toBe(true);
      expect(
        ExerciseInteractionGroupSchema.safeParse(exercise.interaction_group)
          .success,
      ).toBe(true);
      expect(ExerciseMetricSchema.safeParse(exercise.metric_logged).success).toBe(true);
      expect(exercise.tracking_modes.length).toBeGreaterThan(0);
      for (const mode of exercise.tracking_modes) {
        expect(TrackingModeSchema.safeParse(mode).success).toBe(true);
      }
    }
  });

  it("includes camera/manual, timer, and manual-only examples", () => {
    expect(
      EXERCISES.some(
        (exercise) =>
          exercise.positions.includes("seated") &&
          exercise.tracking_modes.includes("camera_manual"),
      ),
    ).toBe(true);
    expect(
      EXERCISES.some((exercise) => exercise.tracking_modes.includes("timer")),
    ).toBe(true);
    expect(
      EXERCISES.some(
        (exercise) =>
          exercise.tracking_modes.length === 1 &&
          exercise.tracking_modes[0] === "manual",
      ),
    ).toBe(true);
  });

  it("contains the reference-table style wheelchair, mobility-aid, and pool-access entries", () => {
    expect(EXERCISES.some((exercise) => exercise.equipment.includes("wheelchair"))).toBe(true);
    expect(EXERCISES.some((exercise) => exercise.equipment.includes("mobility_aid"))).toBe(true);
    expect(EXERCISES.some((exercise) => exercise.equipment.includes("pool_access"))).toBe(true);
  });

  it("marks the reliable pose-counting candidates as camera/manual", () => {
    const reliableCameraIds = [
      "seated_bicep_curl",
      "seated_overhead_press",
      "wall_pushup",
      "seated_march",
      "seated_knee_extension",
      "seated_band_row",
    ];

    for (const id of reliableCameraIds) {
      expect(getExerciseById(id)?.tracking_modes).toContain("camera_manual");
    }
  });

  it("keeps subtle or occluded movement candidates manual-only", () => {
    expect(getExerciseById("wheelchair_pushups")?.tracking_modes).toEqual([
      "manual",
    ]);
    expect(getExerciseById("wheelchair_pushups")).toEqual(
      expect.objectContaining({
        interaction_group: "counter",
        metric_logged: "reps",
      }),
    );
    expect(getExerciseById("grip_strengthening")?.tracking_modes).toEqual([
      "manual",
    ]);
    expect(getExerciseById("grip_strengthening")).toEqual(
      expect.objectContaining({
        interaction_group: "counter",
        metric_logged: "reps_or_hold_seconds",
      }),
    );
  });

  it("groups holds and flows separately from rep-counted strength work", () => {
    expect(getExerciseById("supported_weight_shifts")).toEqual(
      expect.objectContaining({
        category: "balance",
        interaction_group: "timer",
        tracking_modes: ["camera_manual", "timer"],
        metric_logged: "hold_time_sets",
      }),
    );
    expect(getExerciseById("seated_adaptive_yoga")).toEqual(
      expect.objectContaining({
        category: "flexibility",
        interaction_group: "timer",
        tracking_modes: ["timer"],
        metric_logged: "session_duration",
      }),
    );
    expect(getExerciseById("seated_tai_chi")).toEqual(
      expect.objectContaining({
        category: "balance",
        interaction_group: "timer",
        tracking_modes: ["timer"],
        metric_logged: "session_duration",
      }),
    );
  });
});

describe("filterExercisesForAbilities", () => {
  it("matches positions and equipment while excluding avoided regions", () => {
    const abilities: Abilities = {
      positions: ["seated"],
      equipment: ["none", "chair"],
      avoid_regions: ["shoulders"],
      sensory: BASE_SENSORY,
    };

    const filtered = filterExercisesForAbilities(abilities);

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((exercise) => exercise.positions.includes("seated"))).toBe(true);
    expect(
      filtered.every((exercise) =>
        exercise.equipment.some((item) => abilities.equipment.includes(item)),
      ),
    ).toBe(true);
    expect(
      filtered.every((exercise) => !exercise.body_regions.includes("shoulders")),
    ).toBe(true);
  });

  it("does not include specialized equipment unless selected", () => {
    const defaultLikeAbilities: Abilities = {
      positions: ["seated", "lying"],
      equipment: ["none", "chair", "wall"],
      avoid_regions: [],
      sensory: BASE_SENSORY,
    };

    const filtered = filterExercisesForAbilities(defaultLikeAbilities);

    expect(filtered.some((exercise) => exercise.id === "wheelchair_pushing")).toBe(false);
    expect(filtered.some((exercise) => exercise.id === "wheelchair_pushups")).toBe(false);
    expect(filtered.some((exercise) => exercise.id === "swimming")).toBe(false);
    expect(filtered.some((exercise) => exercise.id === "walking_mobility_aids")).toBe(false);
  });

  it("includes wheelchair exercises when wheelchair equipment is selected", () => {
    const abilities: Abilities = {
      positions: ["seated"],
      equipment: ["wheelchair"],
      avoid_regions: [],
      sensory: BASE_SENSORY,
    };

    const filtered = filterExercisesForAbilities(abilities);

    expect(filtered.some((exercise) => exercise.id === "wheelchair_pushing")).toBe(true);
    expect(filtered.some((exercise) => exercise.id === "wheelchair_pushups")).toBe(true);
  });
});

describe("library display and prompt helpers", () => {
  it("groups filtered exercises by category for the dashboard", () => {
    const grouped = groupExercisesByCategory(EXERCISES);

    expect(grouped.strength.length).toBeGreaterThan(0);
    expect(grouped.cardio.length).toBeGreaterThan(0);
    expect(grouped.flexibility.length).toBeGreaterThan(0);
    expect(grouped.core.length).toBeGreaterThan(0);
    expect(grouped.balance.length).toBeGreaterThan(0);
  });

  it("groups the requested strong picks by logging interaction", () => {
    const grouped = groupExercisesByInteraction(EXERCISES);
    const counterIds = grouped.counter.map((exercise) => exercise.id);
    const timerIds = grouped.timer.map((exercise) => exercise.id);
    const manualEntryIds = grouped.manual_entry.map((exercise) => exercise.id);

    expect(counterIds).toEqual(
      expect.arrayContaining([
        "wheelchair_pushups",
        "seated_band_row",
        "seated_overhead_press",
        "seated_bicep_curl",
        "wall_pushup",
        "seated_knee_extension",
        "grip_strengthening",
        "seated_march",
      ]),
    );
    expect(timerIds).toEqual(
      expect.arrayContaining([
        "seated_adaptive_yoga",
        "seated_torso_twist",
        "stretching_routine",
        "seated_tai_chi",
        "supported_weight_shifts",
        "wheelchair_seated_dance",
      ]),
    );
    expect(manualEntryIds).toEqual(
      expect.arrayContaining([
        "wheelchair_pushing",
        "walking_mobility_aids",
        "swimming",
      ]),
    );
  });

  it("passes T22 metadata through the workout prompt payload", () => {
    const promptExercise = exerciseForWorkoutPrompt(EXERCISES[0]);

    expect(promptExercise).toEqual(
      expect.objectContaining({
        exercise_id: EXERCISES[0].id,
        category: EXERCISES[0].category,
        interaction_group: EXERCISES[0].interaction_group,
        tracking_modes: EXERCISES[0].tracking_modes,
        metric_logged: EXERCISES[0].metric_logged,
      }),
    );
  });
});
