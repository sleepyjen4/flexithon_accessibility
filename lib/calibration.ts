import type { PersonalRange } from "@/types";

/**
 * Calibration math for the hands-free hero exercise (T08, F9). Pure functions
 * only — no MediaPipe, no React — so the range logic is easy to reason about
 * and reuse.
 */

/**
 * Fraction of the observed peak we actually ask the user to reach each rep.
 * Calibration captures a best-effort stretch; targeting 85% of it keeps every
 * working rep comfortably achievable instead of demanding a maximal effort.
 */
export const COMFORT_MARGIN = 0.85;

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
 * The peak target sits at `COMFORT_MARGIN` of the way from the resting angle to
 * the observed peak, so hitting range on every rep stays realistic.
 */
export function computeRange(
  observedMinDeg: number,
  observedMaxDeg: number,
  now: Date = new Date(),
): PersonalRange {
  const low = Math.min(observedMinDeg, observedMaxDeg);
  const high = Math.max(observedMinDeg, observedMaxDeg);
  const target = low + (high - low) * COMFORT_MARGIN;
  return {
    minDeg: Math.round(low),
    maxDeg: Math.round(target),
    capturedAt: now.toISOString(),
  };
}

/** True when the captured movement is large enough to be a real calibration. */
export function isUsableSweep(observedMinDeg: number, observedMaxDeg: number): boolean {
  return Math.abs(observedMaxDeg - observedMinDeg) >= MIN_CALIBRATION_SWEEP_DEGREES;
}

/**
 * Hysteresis thresholds for rep counting, derived from a personal range: count
 * a rep once the arm rises past `up`, and re-arm only after it drops below
 * `down`. The gap between them is what prevents jitter double-counts.
 */
export function repThresholds(range: PersonalRange): { up: number; down: number } {
  const span = range.maxDeg - range.minDeg;
  return {
    up: range.minDeg + span * 0.7, // most of the way to the personal peak
    down: range.minDeg + span * 0.25, // clearly back toward rest
  };
}
