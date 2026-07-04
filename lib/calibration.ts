import type { PersonalRange } from "@/types";

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
export function isUsableSweep(observedMinDeg: number, observedMaxDeg: number): boolean {
  return Math.abs(observedMaxDeg - observedMinDeg) >= MIN_CALIBRATION_SWEEP_DEGREES;
}
