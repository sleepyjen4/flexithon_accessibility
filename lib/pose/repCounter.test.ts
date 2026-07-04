import { describe, expect, it } from "vitest";
import {
  initialRepCounterState,
  stepRepCounter,
  thresholdsFromRange,
  type RepCounterState,
} from "./repCounter";

const THRESHOLDS = { up: 85, down: 15 };

function run(readings: (number | null)[], thresholds = THRESHOLDS): RepCounterState {
  let state = initialRepCounterState();
  for (const angle of readings) {
    state = stepRepCounter(state, angle, thresholds);
  }
  return state;
}

describe("stepRepCounter", () => {
  it("counts a clean rep", () => {
    const state = run([10, 50, 90, 95, 60, 20, 5]);
    expect(state.repCount).toBe(1);
  });

  it("counts consecutive clean reps", () => {
    const state = run([10, 90, 10, 90, 10, 90]);
    expect(state.repCount).toBe(3);
  });

  it("does not double-count jitter around the up threshold", () => {
    const state = run([10, 90, 84, 90, 86, 90]);
    expect(state.repCount).toBe(1);
  });

  it("does not double-count jitter around the down threshold before re-arming", () => {
    const state = run([10, 90, 20, 16, 20, 16, 5, 90]);
    // Never dropped below 15 until the final descent, so only re-arms once.
    expect(state.repCount).toBe(2);
  });

  it("does not phantom-count a visibility dropout mid-rep", () => {
    const state = run([10, 90, null, null, 95, 92]);
    expect(state.repCount).toBe(1);
  });

  it("does not count a partial rep that never reaches the up threshold", () => {
    const state = run([10, 50, 70, 60, 20]);
    expect(state.repCount).toBe(0);
  });

  it("tracks the peak angle seen, including during a visibility dropout", () => {
    const state = run([10, 50, 95, null, 60]);
    expect(state.peakDeg).toBe(95);
  });
});

describe("thresholdsFromRange", () => {
  it("derives up/down thresholds as 85%/15% of the personal range", () => {
    expect(thresholdsFromRange({ minDeg: 0, maxDeg: 100 })).toEqual({ up: 85, down: 15 });
  });

  it("works for a narrower personal range", () => {
    expect(thresholdsFromRange({ minDeg: 20, maxDeg: 60 })).toEqual({ up: 54, down: 26 });
  });
});
