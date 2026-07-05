import { describe, expect, it } from "vitest";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { measureActiveSide, type LandmarkFrame } from "./realProvider";
import { getPoseExerciseById, poseExerciseForSide } from "./exercises";

// Arm-raise landmark indices: left elbow/shoulder/hip = 13/11/23, mirrored to
// the right = 14/12/24. Angle is measured AT THE SHOULDER (the middle index).
const ARM_RAISE = getPoseExerciseById("seated_arm_raise")!;
// Bicep-curl indices: left shoulder/elbow/wrist = 11/13/15. Angle is AT THE
// ELBOW and inverted (180 - angle) so a full curl reads as a HIGH value.
const BICEP_CURL = getPoseExerciseById("seated_bicep_curl")!;

/** A 33-slot landmark frame; unset points sit at the origin, fully visible. */
function frame(
  points: Record<number, Partial<NormalizedLandmark>>,
): LandmarkFrame {
  return Array.from({ length: 33 }, (_, index) => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 1,
    ...points[index],
  })) as NormalizedLandmark[];
}

// Left arm resting at the side (elbow straight below the shoulder → ~0° at the
// shoulder); right arm raised out to the side (elbow horizontal → ~90°). Hips
// sit straight below each shoulder.
const LEFT_DOWN_RIGHT_UP = frame({
  11: { x: 0.4, y: 0.4 }, // left shoulder
  13: { x: 0.4, y: 0.55 }, // left elbow (down)
  23: { x: 0.4, y: 0.7 }, // left hip
  12: { x: 0.6, y: 0.4 }, // right shoulder
  14: { x: 0.8, y: 0.4 }, // right elbow (out to the side)
  24: { x: 0.6, y: 0.7 }, // right hip
});

describe("measureActiveSide", () => {
  it("'either' follows the working arm (takes the higher shoulder angle)", () => {
    const either = poseExerciseForSide(ARM_RAISE, "either");
    const { angle } = measureActiveSide(LEFT_DOWN_RIGHT_UP, either, 1);
    // Right arm is up (~90°), left is down (~0°) → either must report the raise.
    expect(angle).toBeGreaterThan(80);
  });

  it("explicit 'left' tracks only the left arm, ignoring the raised right", () => {
    const left = poseExerciseForSide(ARM_RAISE, "left");
    const { angle } = measureActiveSide(LEFT_DOWN_RIGHT_UP, left, 1);
    expect(angle).toBeLessThan(20); // left arm is down
  });

  it("explicit 'right' tracks only the raised right arm", () => {
    const right = poseExerciseForSide(ARM_RAISE, "right");
    const { angle } = measureActiveSide(LEFT_DOWN_RIGHT_UP, right, 1);
    expect(angle).toBeGreaterThan(80);
  });

  it("'either' falls back to the visible side when the working arm drops out", () => {
    // Right arm raised but its landmarks are occluded (low visibility); the left
    // arm is down but fully visible. Counting must not pause — it uses the left.
    const occludedRight = frame({
      11: { x: 0.4, y: 0.4 },
      13: { x: 0.4, y: 0.55 },
      23: { x: 0.4, y: 0.7 },
      12: { x: 0.6, y: 0.4, visibility: 0.2 },
      14: { x: 0.8, y: 0.4, visibility: 0.2 },
      24: { x: 0.6, y: 0.7, visibility: 0.2 },
    });
    const either = poseExerciseForSide(ARM_RAISE, "either");
    const { angle, visibility } = measureActiveSide(occludedRight, either, 1);
    expect(angle).not.toBeNull();
    expect(angle).toBeLessThan(20); // the visible left arm, which is down
    expect(visibility).toBe(1); // better of the two sides → not paused
  });

  it("reports a HIGH effort angle for a fully flexed bicep curl (inverted)", () => {
    // Left arm curled: wrist raised up toward the shoulder (small elbow angle),
    // which inverts to a large flexion value.
    const leftCurled = frame({
      11: { x: 0.4, y: 0.4 }, // shoulder
      13: { x: 0.4, y: 0.55 }, // elbow
      15: { x: 0.55, y: 0.45 }, // wrist curled up
    });
    const { angle } = measureActiveSide(
      leftCurled,
      poseExerciseForSide(BICEP_CURL, "left"),
      1,
    );
    expect(angle).toBeGreaterThan(100);
  });

  it("reports a LOW effort angle for a straight (extended) arm", () => {
    const leftExtended = frame({
      11: { x: 0.4, y: 0.4 },
      13: { x: 0.4, y: 0.55 },
      15: { x: 0.4, y: 0.7 }, // wrist straight below → ~180° elbow → ~0° flexion
    });
    const { angle } = measureActiveSide(
      leftExtended,
      poseExerciseForSide(BICEP_CURL, "left"),
      1,
    );
    expect(angle).toBeLessThan(20);
  });

  it("'either' curl follows the arm that is curling", () => {
    // Left arm curled (high flexion), right arm hanging straight (low flexion).
    const leftCurlRightStraight = frame({
      11: { x: 0.4, y: 0.4 },
      13: { x: 0.4, y: 0.55 },
      15: { x: 0.55, y: 0.45 }, // left wrist curled up
      12: { x: 0.6, y: 0.4 },
      14: { x: 0.6, y: 0.55 },
      16: { x: 0.6, y: 0.7 }, // right wrist straight below
    });
    const { angle } = measureActiveSide(
      leftCurlRightStraight,
      poseExerciseForSide(BICEP_CURL, "either"),
      1,
    );
    expect(angle).toBeGreaterThan(100);
  });

  it("pauses (null angle) only when both sides are out of frame", () => {
    const bothOccluded = frame({
      11: { x: 0.4, y: 0.4, visibility: 0.1 },
      13: { x: 0.4, y: 0.55, visibility: 0.1 },
      23: { x: 0.4, y: 0.7, visibility: 0.1 },
      12: { x: 0.6, y: 0.4, visibility: 0.1 },
      14: { x: 0.8, y: 0.4, visibility: 0.1 },
      24: { x: 0.6, y: 0.7, visibility: 0.1 },
    });
    const either = poseExerciseForSide(ARM_RAISE, "either");
    const { angle } = measureActiveSide(bothOccluded, either, 1);
    expect(angle).toBeNull();
  });
});
