import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANGE,
  MIN_CALIBRATION_SWEEP_DEGREES,
  createCalibrationCapture,
  computeRange,
  isUsableSweep,
} from "./calibration";

const VISIBLE = 0.9;
const OCCLUDED = 0.3;

function frame(angleDeg: number, visibility = VISIBLE, timestamp = 0) {
  return { angleDeg, visibility, timestamp };
}

function feed(angles: number[], visibility = VISIBLE) {
  const capture = createCalibrationCapture();
  const events = angles.flatMap((angleDeg, index) =>
    capture.update(frame(angleDeg, visibility, index * 33)),
  );
  return { capture, events };
}

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
    expect(isUsableSweep(40, 40 + MIN_CALIBRATION_SWEEP_DEGREES - 1)).toBe(
      false,
    );
  });
});

describe("DEFAULT_RANGE", () => {
  it("provides a gentle fallback when calibration is skipped", () => {
    expect(DEFAULT_RANGE).toEqual({ minDeg: 20, maxDeg: 80 });
  });
});

describe("createCalibrationCapture", () => {
  it("counts three guided movements with 85/15 hysteresis and records min/max", () => {
    const { capture, events } = feed([
      20, 45, 75, 92, 100, 82, 45, 28, 22, 48, 78, 94, 103, 80, 42, 27, 21, 50,
      80, 96, 105, 78, 43, 26,
    ]);

    expect(
      events.filter((event) => event.type === "range_reached"),
    ).toHaveLength(3);
    expect(events.filter((event) => event.type === "rep")).toEqual([
      { type: "rep", count: 1 },
      { type: "rep", count: 2 },
      { type: "rep", count: 3 },
    ]);
    expect(capture.getSnapshot()).toEqual({
      minDeg: 20,
      maxDeg: 105,
      sweeps: 3,
    });
  });

  it("does not double-count jitter near the top threshold", () => {
    const { capture, events } = feed([
      20, 50, 80, 91, 96, 91, 96, 91, 96, 70, 40, 28,
    ]);

    expect(
      events.filter((event) => event.type === "range_reached"),
    ).toHaveLength(1);
    expect(events.filter((event) => event.type === "rep")).toEqual([
      { type: "rep", count: 1 },
    ]);
    expect(capture.getSnapshot().sweeps).toBe(1);
  });

  it("pauses on visibility dropout and does not count across the gap", () => {
    const capture = createCalibrationCapture();
    const events = [
      ...[20, 50, 80, 100].flatMap((angleDeg, index) =>
        capture.update(frame(angleDeg, VISIBLE, index * 33)),
      ),
      ...[96, 80, 45].flatMap((angleDeg, index) =>
        capture.update(frame(angleDeg, OCCLUDED, 1000 + index * 33)),
      ),
      ...[28, 25, 24].flatMap((angleDeg, index) =>
        capture.update(frame(angleDeg, VISIBLE, 2000 + index * 33)),
      ),
    ];

    expect(events).toEqual([
      { type: "range_reached" },
      { type: "tracking_paused" },
      { type: "tracking_resumed" },
    ]);
    expect(capture.getSnapshot().sweeps).toBe(0);
  });

  it("does not count a later partial movement that never reaches the established top", () => {
    const { capture, events } = feed([
      20, 45, 75, 95, 100, 82, 45, 28, 25, 45, 65, 74, 68, 45, 25,
    ]);

    expect(events.filter((event) => event.type === "rep")).toEqual([
      { type: "rep", count: 1 },
    ]);
    expect(capture.getSnapshot().sweeps).toBe(1);
  });
});
