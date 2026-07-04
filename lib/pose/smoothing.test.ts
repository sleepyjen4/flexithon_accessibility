import { describe, expect, it } from "vitest";
import { DEFAULT_ALPHA, smoothWithEma } from "./smoothing";

describe("smoothWithEma", () => {
  it("seeds the average with the first sample when previous is null", () => {
    expect(smoothWithEma(null, 42)).toBe(42);
  });

  it("blends toward the new sample using the default alpha", () => {
    // alpha * sample + (1 - alpha) * previous = 0.3 * 100 + 0.7 * 0 = 30
    expect(smoothWithEma(0, 100)).toBeCloseTo(30, 10);
  });

  it("returns the previous value unchanged when the sample matches it", () => {
    expect(smoothWithEma(50, 50)).toBeCloseTo(50, 10);
  });

  it("respects a custom alpha", () => {
    // alpha * sample + (1 - alpha) * previous = 0.5 * 10 + 0.5 * 0 = 5
    expect(smoothWithEma(0, 10, 0.5)).toBeCloseTo(5, 10);
  });

  it("converges toward a constant input stream over successive calls", () => {
    let value: number | null = null;
    for (let i = 0; i < 50; i++) {
      value = smoothWithEma(value, 100);
    }
    expect(value).toBeCloseTo(100, 5);
  });

  it("dampens a single noisy spike more with a lower alpha", () => {
    const highAlphaResult = smoothWithEma(20, 120, 0.3);
    const lowAlphaResult = smoothWithEma(20, 120, 0.15);
    expect(Math.abs(lowAlphaResult - 20)).toBeLessThan(
      Math.abs(highAlphaResult - 20)
    );
  });

  it("exports 0.3 as the default alpha", () => {
    expect(DEFAULT_ALPHA).toBe(0.3);
  });
});
