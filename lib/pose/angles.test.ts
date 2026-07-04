import { describe, expect, it } from "vitest";
import { calculateAngle, type Point2D } from "./angles";

const ORIGIN: Point2D = { x: 0, y: 0 };

describe("calculateAngle", () => {
  it("returns 90 for a right angle (vertical + horizontal rays)", () => {
    const a: Point2D = { x: 0, y: 1 };
    const c: Point2D = { x: 1, y: 0 };
    expect(calculateAngle(a, ORIGIN, c)).toBeCloseTo(90, 10);
  });

  it("returns 180 for a straight line through the vertex", () => {
    const a: Point2D = { x: -1, y: 0 };
    const c: Point2D = { x: 1, y: 0 };
    expect(calculateAngle(a, ORIGIN, c)).toBeCloseTo(180, 10);
  });

  it("returns 0 when both rays point the same direction", () => {
    const a: Point2D = { x: 1, y: 0 };
    const c: Point2D = { x: 2, y: 0 };
    expect(calculateAngle(a, ORIGIN, c)).toBeCloseTo(0, 10);
  });

  it("returns 45 for a known 45-degree triangle", () => {
    const a: Point2D = { x: 1, y: 1 };
    const c: Point2D = { x: 1, y: 0 };
    expect(calculateAngle(a, ORIGIN, c)).toBeCloseTo(45, 10);
  });

  it("returns 60 for an equilateral triangle", () => {
    const b: Point2D = { x: 0, y: 0 };
    const a: Point2D = { x: 1, y: 0 };
    const c: Point2D = { x: 0.5, y: Math.sqrt(3) / 2 };
    expect(calculateAngle(a, b, c)).toBeCloseTo(60, 10);
  });

  it("is symmetric under swapping a and c", () => {
    const a: Point2D = { x: 3, y: 1 };
    const b: Point2D = { x: 1, y: 1 };
    const c: Point2D = { x: 1, y: 4 };
    expect(calculateAngle(a, b, c)).toBeCloseTo(calculateAngle(c, b, a), 10);
  });

  it("never returns NaN for degenerate input (coincident landmarks)", () => {
    // Landmark dropout can yield coincident points; downstream rep counting
    // must never see NaN. atan2(0, 0) is 0 in JS, so this stays finite.
    expect(Number.isNaN(calculateAngle(ORIGIN, ORIGIN, ORIGIN))).toBe(false);
    expect(
      Number.isNaN(calculateAngle({ x: 1, y: 1 }, ORIGIN, ORIGIN))
    ).toBe(false);
  });

  it("is invariant to vertex translation (only relative geometry matters)", () => {
    const a: Point2D = { x: 0, y: 1 };
    const b: Point2D = { x: 0, y: 0 };
    const c: Point2D = { x: 1, y: 0 };
    const shift = { x: 50, y: -30 };
    const shiftedAngle = calculateAngle(
      { x: a.x + shift.x, y: a.y + shift.y },
      { x: b.x + shift.x, y: b.y + shift.y },
      { x: c.x + shift.x, y: c.y + shift.y }
    );
    expect(shiftedAngle).toBeCloseTo(calculateAngle(a, b, c), 10);
  });
});
