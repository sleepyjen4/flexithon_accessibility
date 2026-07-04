import { describe, expect, it } from "vitest";
import { emaStep, jointAngleDegrees, visibleJointAngleDegrees } from "./angle";

describe("jointAngleDegrees", () => {
  it("computes a right angle", () => {
    const vertex = { x: 0, y: 0 };
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 1 };
    expect(jointAngleDegrees(a, vertex, b)).toBeCloseTo(90);
  });

  it("computes a straight line as 180 degrees", () => {
    const vertex = { x: 0, y: 0 };
    const a = { x: -1, y: 0 };
    const b = { x: 1, y: 0 };
    expect(jointAngleDegrees(a, vertex, b)).toBeCloseTo(180);
  });

  it("computes zero degrees for overlapping rays", () => {
    const vertex = { x: 0, y: 0 };
    const a = { x: 1, y: 0 };
    const b = { x: 2, y: 0 };
    expect(jointAngleDegrees(a, vertex, b)).toBeCloseTo(0);
  });
});

describe("visibleJointAngleDegrees", () => {
  const vertex = { x: 0, y: 0, visibility: 1 };
  const a = { x: 1, y: 0, visibility: 1 };
  const b = { x: 0, y: 1, visibility: 1 };

  it("returns the angle when all landmarks are visible", () => {
    expect(visibleJointAngleDegrees(a, vertex, b)).toBeCloseTo(90);
  });

  it("returns null when any landmark visibility drops below threshold", () => {
    const occluded = { ...b, visibility: 0.2 };
    expect(visibleJointAngleDegrees(a, vertex, occluded)).toBeNull();
  });
});

describe("emaStep", () => {
  it("seeds with the first reading", () => {
    expect(emaStep(null, 42)).toBe(42);
  });

  it("smooths toward the new reading by alpha", () => {
    expect(emaStep(100, 130, 0.3)).toBeCloseTo(109);
  });
});
