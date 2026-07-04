import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANGE,
  MIN_CALIBRATION_SWEEP_DEGREES,
  computeRange,
  isUsableSweep,
} from "./calibration";

describe("computeRange", () => {
  it("stores the observed min and max without applying the 85% comfort margin", () => {
    const range = computeRange(22, 88, new Date("2026-07-04T06:00:00.000Z"));
    expect(range).toEqual({
      minDeg: 22,
      maxDeg: 88,
      capturedAt: "2026-07-04T06:00:00.000Z",
    });
  });

  it("normalizes reversed min/max inputs", () => {
    const range = computeRange(90, 25);
    expect(range.minDeg).toBe(25);
    expect(range.maxDeg).toBe(90);
  });
});

describe("isUsableSweep", () => {
  it("accepts sweeps at or above the minimum span", () => {
    expect(isUsableSweep(20, 20 + MIN_CALIBRATION_SWEEP_DEGREES)).toBe(true);
  });

  it("rejects sweeps that barely moved", () => {
    expect(isUsableSweep(40, 40 + MIN_CALIBRATION_SWEEP_DEGREES - 1)).toBe(false);
  });
});

describe("DEFAULT_RANGE", () => {
  it("provides a gentle fallback when calibration is skipped", () => {
    expect(DEFAULT_RANGE).toEqual({ minDeg: 20, maxDeg: 80 });
  });
});
