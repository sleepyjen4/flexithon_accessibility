import { describe, expect, it } from "vitest";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ExerciseDef, PersonalRange } from "@/types";
import { measureActiveSide, type LandmarkFrame } from "./realProvider";
import { getPoseExerciseById, poseExerciseForSide } from "./exercises";
import { createRepCounter } from "./repCounter";
import { createCalibrationCapture, computeRange } from "@/lib/calibration";

/**
 * End-to-end logic tests for the hands-free tracker (T13): synthetic upper-body
 * landmarks are driven through the exact production path — `measureActiveSide`
 * (side resolution + flexion inversion) feeding `createRepCounter` — so we can
 * assert "N clean reps count" for both movements and every single-limb mode
 * without a camera. No MediaPipe, no React: only the pure functions the live
 * provider calls each frame.
 */

const ARM_RAISE = getPoseExerciseById("seated_arm_raise")!;
const BICEP_CURL = getPoseExerciseById("seated_bicep_curl")!;

type Kind = "arm_raise" | "curl";
type Side = "left" | "right";

const SEGMENT = 0.15; // upper-arm / forearm length in normalized units

const other = (side: Side): Side => (side === "left" ? "right" : "left");

/** Landmark positions for one arm at a given effort (degrees). */
function armRaisePoints(
  side: Side,
  effortDeg: number,
): Record<number, { x: number; y: number }> {
  const theta = (effortDeg * Math.PI) / 180;
  const dx = SEGMENT * Math.sin(theta);
  const dy = SEGMENT * Math.cos(theta);
  if (side === "left") {
    // shoulder 11, elbow 13, hip 23; arm opens out to the left (-x).
    return {
      11: { x: 0.4, y: 0.4 },
      13: { x: 0.4 - dx, y: 0.4 + dy },
      23: { x: 0.4, y: 0.7 },
    };
  }
  return {
    12: { x: 0.6, y: 0.4 },
    14: { x: 0.6 + dx, y: 0.4 + dy },
    24: { x: 0.6, y: 0.7 },
  };
}

/** Landmark positions for one curling arm. effortDeg is the flexion angle the
 * provider reads (180 - elbow angle): 0 ≈ straight, ~140 ≈ fully curled. */
function curlPoints(
  side: Side,
  effortDeg: number,
): Record<number, { x: number; y: number }> {
  const alpha = ((180 - effortDeg) * Math.PI) / 180; // geometric elbow angle
  const dx = SEGMENT * Math.sin(alpha);
  const dy = SEGMENT * Math.cos(alpha);
  if (side === "left") {
    // shoulder 11, elbow 13, wrist 15; forearm swings up toward the shoulder.
    return {
      11: { x: 0.4, y: 0.4 },
      13: { x: 0.4, y: 0.55 },
      15: { x: 0.4 - dx, y: 0.55 - dy },
    };
  }
  return {
    12: { x: 0.6, y: 0.4 },
    14: { x: 0.6, y: 0.55 },
    16: { x: 0.6 + dx, y: 0.55 - dy }, // mirror: forearm swings up to the right
  };
}

/** A full 33-slot frame; the moving side is at `effortDeg`, the other rests. */
function buildFrame(kind: Kind, movingSide: Side, effortDeg: number): LandmarkFrame {
  const points =
    kind === "arm_raise"
      ? { ...armRaisePoints(movingSide, effortDeg), ...armRaisePoints(other(movingSide), 0) }
      : { ...curlPoints(movingSide, effortDeg), ...curlPoints(other(movingSide), 0) };

  return Array.from({ length: 33 }, (_, index) => {
    const point = points[index];
    return { x: point?.x ?? 0, y: point?.y ?? 0, z: 0, visibility: 1 };
  }) as NormalizedLandmark[];
}

const STEPS_PER_RAMP = 12;

/** Drives `reps` clean up-down cycles through the real measure+count path and
 * returns how many reps the counter registered. */
function countReps(
  exercise: ExerciseDef,
  movingSide: Side,
  kind: Kind,
  range: PersonalRange,
  effortLo: number,
  effortHi: number,
  reps: number,
): number {
  const counter = createRepCounter(range);
  const feed = (effortDeg: number) => {
    const frame = buildFrame(kind, movingSide, effortDeg);
    const { angle, visibility } = measureActiveSide(frame, exercise, 1);
    counter.update({ angleDeg: angle ?? Number.NaN, visibility, timestamp: 0 });
  };

  feed(effortLo); // establish a baseline below the counter's down threshold
  for (let rep = 0; rep < reps; rep += 1) {
    for (let i = 1; i <= STEPS_PER_RAMP; i += 1) {
      feed(effortLo + ((effortHi - effortLo) * i) / STEPS_PER_RAMP);
    }
    for (let i = 1; i <= STEPS_PER_RAMP; i += 1) {
      feed(effortHi - ((effortHi - effortLo) * i) / STEPS_PER_RAMP);
    }
  }
  return counter.getCount();
}

describe("arm raise — full pipeline", () => {
  const range: PersonalRange = { minDeg: 10, maxDeg: 90 };

  it("counts every clean rep on the left arm", () => {
    const reps = countReps(
      poseExerciseForSide(ARM_RAISE, "left"),
      "left",
      "arm_raise",
      range,
      5,
      92,
      5,
    );
    expect(reps).toBe(5);
  });

  it("'either' follows whichever arm is raised (right)", () => {
    const reps = countReps(
      poseExerciseForSide(ARM_RAISE, "either"),
      "right",
      "arm_raise",
      range,
      5,
      92,
      4,
    );
    expect(reps).toBe(4);
  });

  it("'either' follows whichever arm is raised (left)", () => {
    const reps = countReps(
      poseExerciseForSide(ARM_RAISE, "either"),
      "left",
      "arm_raise",
      range,
      5,
      92,
      3,
    );
    expect(reps).toBe(3);
  });

  it("single-limb isolation: side 'left' ignores a moving right arm", () => {
    const reps = countReps(
      poseExerciseForSide(ARM_RAISE, "left"),
      "right",
      "arm_raise",
      range,
      5,
      92,
      5,
    );
    expect(reps).toBe(0);
  });
});

describe("bicep curl — full pipeline (flexion inversion)", () => {
  const range: PersonalRange = { minDeg: 0, maxDeg: 140 };

  it("counts every clean curl on the left arm", () => {
    const reps = countReps(
      poseExerciseForSide(BICEP_CURL, "left"),
      "left",
      "curl",
      range,
      2,
      140,
      4,
    );
    expect(reps).toBe(4);
  });

  it("counts curls on an explicitly selected right arm", () => {
    const reps = countReps(
      poseExerciseForSide(BICEP_CURL, "right"),
      "right",
      "curl",
      range,
      2,
      140,
      4,
    );
    expect(reps).toBe(4);
  });

  it("'either' follows the curling arm", () => {
    const reps = countReps(
      poseExerciseForSide(BICEP_CURL, "either"),
      "right",
      "curl",
      range,
      2,
      140,
      3,
    );
    expect(reps).toBe(3);
  });
});

describe("calibration ↔ counting round-trip (curl)", () => {
  it("a range captured on the inverted scale then counts reps correctly", () => {
    const calibDef = poseExerciseForSide(BICEP_CURL, "left");

    // 1. Capture: sweep the curl through its range a few times, feeding the same
    //    inverted angle the CalibrationFlow captures.
    const capture = createCalibrationCapture();
    const feedCapture = (effortDeg: number) => {
      const frame = buildFrame("curl", "left", effortDeg);
      const { angle, visibility } = measureActiveSide(frame, calibDef, 1);
      capture.update({
        angleDeg: angle ?? Number.NaN,
        visibility,
        timestamp: 0,
      });
    };
    feedCapture(2);
    for (let sweep = 0; sweep < 3; sweep += 1) {
      for (let i = 1; i <= STEPS_PER_RAMP; i += 1) feedCapture((140 * i) / STEPS_PER_RAMP);
      for (let i = 1; i <= STEPS_PER_RAMP; i += 1) feedCapture(140 - (140 * i) / STEPS_PER_RAMP);
    }

    const snapshot = capture.getSnapshot();
    expect(snapshot.minDeg).not.toBeNull();
    expect(snapshot.maxDeg).not.toBeNull();
    const range = computeRange(snapshot.minDeg as number, snapshot.maxDeg as number);
    // Sanity: the captured range is on the flexion scale (wide, low minimum).
    expect(range.maxDeg - range.minDeg).toBeGreaterThan(100);

    // 2. Count against the captured range — reps must register.
    const reps = countReps(calibDef, "left", "curl", range, 2, 140, 4);
    expect(reps).toBe(4);
  });

  it("an 'either' range can be captured from right-arm curls", () => {
    const calibDef = poseExerciseForSide(BICEP_CURL, "either");
    const capture = createCalibrationCapture();
    const feedCapture = (effortDeg: number) => {
      const frame = buildFrame("curl", "right", effortDeg);
      const { angle, visibility } = measureActiveSide(frame, calibDef, 1);
      capture.update({
        angleDeg: angle ?? Number.NaN,
        visibility,
        timestamp: 0,
      });
    };

    feedCapture(2);
    for (let sweep = 0; sweep < 3; sweep += 1) {
      for (let i = 1; i <= STEPS_PER_RAMP; i += 1) {
        feedCapture((140 * i) / STEPS_PER_RAMP);
      }
      for (let i = 1; i <= STEPS_PER_RAMP; i += 1) {
        feedCapture(140 - (140 * i) / STEPS_PER_RAMP);
      }
    }

    const snapshot = capture.getSnapshot();
    expect(snapshot.minDeg).not.toBeNull();
    expect(snapshot.maxDeg).not.toBeNull();
    const range = computeRange(snapshot.minDeg as number, snapshot.maxDeg as number);
    expect(range.maxDeg - range.minDeg).toBeGreaterThan(100);
    expect(countReps(calibDef, "right", "curl", range, 2, 140, 3)).toBe(3);
  });
});
