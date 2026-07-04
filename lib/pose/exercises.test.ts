import { describe, expect, it } from "vitest";
import type { ExerciseDef } from "@/types";
import { POSE_EXERCISES, getPoseExerciseById } from "./exercises";

const EXPECTED_IDS: ExerciseDef["id"][] = ["seated_arm_raise", "seated_torso_twist"];

describe("POSE_EXERCISES", () => {
  it("defines exactly the two hero exercises from the ExerciseDef contract", () => {
    expect(POSE_EXERCISES.map((exercise) => exercise.id).sort()).toEqual(
      [...EXPECTED_IDS].sort(),
    );
  });

  it.each(POSE_EXERCISES)("$id has a valid, non-degenerate landmark triple", (exercise) => {
    expect(exercise.landmarks).toHaveLength(3);
    const uniqueIndices = new Set(exercise.landmarks);
    expect(uniqueIndices.size).toBe(3); // no repeated index -> no zero-angle degenerate case
    for (const index of exercise.landmarks) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(32); // MediaPipe Pose landmark range
    }
  });

  it.each(POSE_EXERCISES)("$id has non-empty instructions and cues", (exercise) => {
    expect(exercise.instructions.length).toBeGreaterThan(0);
    for (const instruction of exercise.instructions) {
      expect(instruction.trim().length).toBeGreaterThan(0);
    }
    expect(exercise.cues.rangeReached.trim().length).toBeGreaterThan(0);
    expect(exercise.cues.encourage.length).toBeGreaterThan(0);
  });
});

describe("getPoseExerciseById", () => {
  it("finds each exercise by id", () => {
    for (const id of EXPECTED_IDS) {
      expect(getPoseExerciseById(id)?.id).toBe(id);
    }
  });
});
