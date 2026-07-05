import { describe, expect, it } from "vitest";
import type { ExerciseDef } from "@/types";
import {
  CALIBRATION_KEY_BY_POSE_ID,
  POSE_EXERCISES,
  getPoseExerciseById,
  mirrorLandmarkTriple,
  poseExerciseForSide,
  usesInvertedAngle,
} from "./exercises";

const EXPECTED_IDS: ExerciseDef["id"][] = ["seated_arm_raise", "seated_bicep_curl"];

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

describe("mirrorLandmarkTriple", () => {
  it("swaps each upper-body landmark for its left/right twin", () => {
    // left elbow/shoulder/hip -> right elbow/shoulder/hip
    expect(mirrorLandmarkTriple([13, 11, 23])).toEqual([14, 12, 24]);
  });

  it("is its own inverse (mirroring twice returns the original)", () => {
    for (const exercise of POSE_EXERCISES) {
      expect(mirrorLandmarkTriple(mirrorLandmarkTriple(exercise.landmarks))).toEqual(
        exercise.landmarks,
      );
    }
  });

  it("still yields a non-degenerate triple (three distinct indices)", () => {
    for (const exercise of POSE_EXERCISES) {
      const mirrored = mirrorLandmarkTriple(exercise.landmarks);
      expect(new Set(mirrored).size).toBe(3);
    }
  });
});

describe("usesInvertedAngle", () => {
  it("inverts the bicep curl (effort = a smaller elbow angle)", () => {
    expect(usesInvertedAngle("seated_bicep_curl")).toBe(true);
  });

  it("does not invert the arm raise (effort = a larger shoulder angle)", () => {
    expect(usesInvertedAngle("seated_arm_raise")).toBe(false);
  });
});

describe("CALIBRATION_KEY_BY_POSE_ID", () => {
  it("maps every pose exercise to a workout-library key", () => {
    for (const exercise of POSE_EXERCISES) {
      expect(CALIBRATION_KEY_BY_POSE_ID[exercise.id]).toBeTruthy();
    }
  });

  it("keeps the arm-raise two-namespace mapping and the curl's shared id", () => {
    expect(CALIBRATION_KEY_BY_POSE_ID.seated_arm_raise).toBe(
      "seated_lateral_raise",
    );
    expect(CALIBRATION_KEY_BY_POSE_ID.seated_bicep_curl).toBe(
      "seated_bicep_curl",
    );
  });
});

describe("poseExerciseForSide", () => {
  const armRaise = getPoseExerciseById("seated_arm_raise") as ExerciseDef;

  it("tracks the canonical (left) triple for 'left' and 'either'", () => {
    expect(poseExerciseForSide(armRaise, "left").landmarks).toEqual(
      armRaise.landmarks,
    );
    expect(poseExerciseForSide(armRaise, "either").landmarks).toEqual(
      armRaise.landmarks,
    );
  });

  it("tracks the mirrored triple for 'right'", () => {
    expect(poseExerciseForSide(armRaise, "right").landmarks).toEqual(
      mirrorLandmarkTriple(armRaise.landmarks),
    );
  });

  it("records the chosen side and never mutates the source definition", () => {
    const resolved = poseExerciseForSide(armRaise, "right");
    expect(resolved.side).toBe("right");
    expect(armRaise.side).toBe("either"); // source untouched
    expect(armRaise.landmarks).toEqual([13, 11, 23]);
  });
});
