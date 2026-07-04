import type { PersonalRange, PoseFrame, RepEvent } from "@/types";
import { computeThresholds, VISIBILITY_THRESHOLD } from "./pose/repCounter";

/**
 * Calibration math for the hands-free hero exercise (T08, F9). Pure functions
 * only — no MediaPipe, no React — so the range logic is easy to reason about
 * and reuse.
 */

/** Ignore captures that barely moved — likely noise, not a real movement. */
export const MIN_CALIBRATION_SWEEP_DEGREES = 15;

/**
 * A gentle default used when the camera is unavailable or the user opts out of
 * calibration, so the flow never dead-ends (Section 5b: camera is always an
 * enhancement, never a requirement).
 */
export const DEFAULT_RANGE: Omit<PersonalRange, "capturedAt"> = {
  minDeg: 20,
  maxDeg: 80,
};

type CalibrationPhase = "idle" | "rising" | "peaked" | "falling";

export interface CalibrationCaptureSnapshot {
  minDeg: number | null;
  maxDeg: number | null;
  sweeps: number;
}

export interface CalibrationCapture {
  update(frame: PoseFrame): RepEvent[];
  getSnapshot(): CalibrationCaptureSnapshot;
}

/**
 * Counts the three guided calibration movements with the same hysteresis model
 * as T06's rep counter: rise past 85% of the observed range, then return below
 * 15%. Low-visibility frames pause the in-flight movement and never update the
 * captured range.
 */
export function createCalibrationCapture(): CalibrationCapture {
  let phase: CalibrationPhase = "idle";
  let minDeg: number | null = null;
  let maxDeg: number | null = null;
  let sweeps = 0;
  let paused = false;
  let rangeReachedThisSweep = false;
  let previousAngle: number | null = null;

  function snapshot(): CalibrationCaptureSnapshot {
    return { minDeg, maxDeg, sweeps };
  }

  function usableRange(): PersonalRange | null {
    // Calibration must first observe a real min/max sweep before the hysteresis
    // thresholds mean anything. Until then we only collect range endpoints and
    // deliberately do not advance the rep-style state machine.
    if (minDeg === null || maxDeg === null || !isUsableSweep(minDeg, maxDeg)) {
      return null;
    }
    return { minDeg, maxDeg };
  }

  function resetInFlight(): void {
    phase = "idle";
    rangeReachedThisSweep = false;
    previousAngle = null;
  }

  function crossedUp(threshold: number, angle: number): boolean {
    return (
      previousAngle !== null && previousAngle < threshold && angle >= threshold
    );
  }

  function updateRange(angle: number): void {
    if (minDeg === null || angle < minDeg) minDeg = angle;
    if (maxDeg === null || angle > maxDeg) maxDeg = angle;
  }

  function update(frame: PoseFrame): RepEvent[] {
    const events: RepEvent[] = [];

    if (frame.visibility < VISIBILITY_THRESHOLD) {
      if (!paused) {
        paused = true;
        resetInFlight();
        events.push({ type: "tracking_paused" });
      }
      return events;
    }

    if (paused) {
      paused = false;
      events.push({ type: "tracking_resumed" });
    }

    const angle = frame.angleDeg;
    updateRange(angle);

    if (previousAngle === null) {
      previousAngle = angle;
      return events;
    }

    const range = usableRange();
    if (!range) {
      previousAngle = angle;
      return events;
    }

    const { up: upThreshold, down: downThreshold } = computeThresholds(range);

    if (phase === "idle" && angle > downThreshold) {
      phase = "rising";
    }

    if (phase === "rising") {
      if (crossedUp(upThreshold, angle)) {
        phase = "peaked";
        if (!rangeReachedThisSweep) {
          rangeReachedThisSweep = true;
          events.push({ type: "range_reached" });
        }
      } else if (angle <= downThreshold) {
        phase = "idle";
      }
    }

    if (phase === "peaked" && angle < upThreshold) {
      phase = "falling";
    }

    if (phase === "falling") {
      if (crossedUp(upThreshold, angle)) {
        phase = "peaked";
      } else if (angle <= downThreshold) {
        sweeps += 1;
        rangeReachedThisSweep = false;
        phase = "idle";
        events.push({ type: "rep", count: sweeps });
      }
    }

    previousAngle = angle;
    return events;
  }

  return { update, getSnapshot: snapshot };
}

/**
 * Turn the min/max angles observed during calibration into a `PersonalRange`.
 * We store the raw comfortable resting/peak angles — the 85% comfort margin
 * (Section 0: "range_reached = hit 85% of personal max") is applied by the rep
 * counter (`repCounter.ts` / the mock provider) at `0.85 × maxDeg`, so it must
 * NOT be baked in here or it would be double-counted.
 */
export function computeRange(
  observedMinDeg: number,
  observedMaxDeg: number,
  now: Date = new Date(),
): PersonalRange {
  const low = Math.min(observedMinDeg, observedMaxDeg);
  const high = Math.max(observedMinDeg, observedMaxDeg);
  return {
    minDeg: Math.round(low),
    maxDeg: Math.round(high),
    capturedAt: now.toISOString(),
  };
}

/** True when the captured movement is large enough to be a real calibration. */
export function isUsableSweep(
  observedMinDeg: number,
  observedMaxDeg: number,
): boolean {
  return (
    Math.abs(observedMaxDeg - observedMinDeg) >= MIN_CALIBRATION_SWEEP_DEGREES
  );
}
