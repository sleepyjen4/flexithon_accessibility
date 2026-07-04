import type { PersonalRange } from "@/types";

export interface RepThresholds {
  up: number;
  down: number;
}

/** Pre-calibration fallback — roughly the whole-arm range used before F9
 * shipped calibration, so counting still works the first time a camera
 * turns on. Replaced by {@link thresholdsFromRange} once calibrated. */
export const DEFAULT_THRESHOLDS: RepThresholds = { up: 80, down: 30 };

const UP_FRACTION = 0.85; // count once the angle passes 85% of the personal range...
const DOWN_FRACTION = 0.15; // ...and re-arm only after it drops back below 15%

/**
 * Derives rep-count hysteresis thresholds from a calibrated {@link
 * PersonalRange} (Section 5b) so the same jitter margin applies regardless
 * of a person's actual range of motion.
 */
export function thresholdsFromRange(range: PersonalRange): RepThresholds {
  const span = range.maxDeg - range.minDeg;
  return {
    up: range.minDeg + UP_FRACTION * span,
    down: range.minDeg + DOWN_FRACTION * span,
  };
}

export interface RepCounterState {
  armRaised: boolean;
  repCount: number;
  peakDeg: number;
}

export function initialRepCounterState(): RepCounterState {
  return { armRaised: false, repCount: 0, peakDeg: 0 };
}

/**
 * One hysteresis step (Section 5b / T06): idle -> rising -> peaked ->
 * falling -> rep++. A rep counts once the smoothed angle crosses
 * `thresholds.up`; it re-arms only after dropping below `thresholds.down`,
 * so jitter near either threshold never double-counts. Pass `angleDeg =
 * null` (landmarks not visible) to pause counting silently — the state is
 * returned unchanged so a dropout mid-rep never produces a phantom rep.
 */
export function stepRepCounter(
  state: RepCounterState,
  angleDeg: number | null,
  thresholds: RepThresholds = DEFAULT_THRESHOLDS,
): RepCounterState {
  if (angleDeg === null) return state;

  const peakDeg = Math.max(state.peakDeg, angleDeg);

  if (!state.armRaised && angleDeg > thresholds.up) {
    return { armRaised: true, repCount: state.repCount + 1, peakDeg };
  }
  if (state.armRaised && angleDeg < thresholds.down) {
    return { ...state, armRaised: false, peakDeg };
  }
  return { ...state, peakDeg };
}
