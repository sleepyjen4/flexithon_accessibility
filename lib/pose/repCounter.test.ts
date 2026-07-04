import { describe, expect, it } from "vitest";
import type { PersonalRange, PoseFrame, RepEvent } from "@/types";
import { createRepCounter, VISIBILITY_THRESHOLD } from "./repCounter";

// Range 20–150 → up threshold = 20 + 0.85 × 130 = 130.5,
// down threshold = 20 + 0.15 × 130 = 39.5 (same math as mockProvider).
const RANGE: PersonalRange = { minDeg: 20, maxDeg: 150 };

const VISIBLE = 0.9;
const OCCLUDED = 0.3;

function frame(angleDeg: number, visibility: number, timestamp: number): PoseFrame {
  return { angleDeg, visibility, timestamp };
}

/** Feed a sequence of angles (constant visibility) and collect all events. */
function feed(
  counter: ReturnType<typeof createRepCounter>,
  angles: number[],
  visibility: number = VISIBLE,
  startTimestamp = 0
): RepEvent[] {
  return angles.flatMap((angleDeg, i) =>
    counter.update(frame(angleDeg, visibility, startTimestamp + i * 33))
  );
}

const CLEAN_REP = [25, 60, 100, 130, 145, 130, 100, 60, 35];

describe("createRepCounter", () => {
  it("counts a clean rep: range_reached at the top, rep on return to bottom", () => {
    const counter = createRepCounter(RANGE);
    const events = feed(counter, CLEAN_REP);
    expect(events).toEqual([
      { type: "range_reached" },
      { type: "rep", count: 1 },
    ]);
    expect(counter.getCount()).toBe(1);
  });

  it("counts three consecutive clean reps with increasing counts", () => {
    const counter = createRepCounter(RANGE);
    const events = feed(counter, [...CLEAN_REP, ...CLEAN_REP, ...CLEAN_REP]);
    expect(events.filter((e) => e.type === "rep")).toEqual([
      { type: "rep", count: 1 },
      { type: "rep", count: 2 },
      { type: "rep", count: 3 },
    ]);
    expect(events.filter((e) => e.type === "range_reached")).toHaveLength(3);
    expect(counter.getCount()).toBe(3);
  });

  it("does not double-count on jitter around the upper threshold", () => {
    const counter = createRepCounter(RANGE);
    // Oscillates across 130.5 four times before finally descending.
    const events = feed(
      counter,
      [25, 60, 100, 128, 133, 128, 133, 128, 133, 100, 60, 35]
    );
    expect(events).toEqual([
      { type: "range_reached" },
      { type: "rep", count: 1 },
    ]);
  });

  it("does not double-count on jitter around the lower threshold after a rep", () => {
    const counter = createRepCounter(RANGE);
    // Complete one rep, then wobble across 39.5 without going back up.
    const events = feed(counter, [...CLEAN_REP, 41, 38, 41, 38, 41, 38]);
    expect(events.filter((e) => e.type === "rep")).toHaveLength(1);
    expect(events.filter((e) => e.type === "range_reached")).toHaveLength(1);
    expect(counter.getCount()).toBe(1);
  });

  it("does not count a partial rep that never reaches the top", () => {
    const counter = createRepCounter(RANGE);
    const events = feed(counter, [25, 60, 100, 120, 100, 60, 25]);
    expect(events).toEqual([]);
    expect(counter.getCount()).toBe(0);
  });

  it("pauses silently on visibility dropout and never counts a phantom rep", () => {
    const counter = createRepCounter(RANGE);
    const events: RepEvent[] = [];
    // Rise to the top while visible…
    events.push(...feed(counter, [25, 60, 100, 130, 145]));
    // …lose tracking mid-rep (several occluded frames in a row)…
    events.push(...feed(counter, [145, 140, 138], OCCLUDED, 1000));
    // …regain tracking at the bottom and stay still.
    events.push(...feed(counter, [30, 27, 25], VISIBLE, 2000));

    expect(events).toEqual([
      { type: "range_reached" },
      { type: "tracking_paused" },
      { type: "tracking_resumed" },
    ]);
    expect(counter.getCount()).toBe(0);
  });

  it("emits tracking_paused/resumed once each, not per occluded frame", () => {
    const counter = createRepCounter(RANGE);
    const events = [
      ...feed(counter, [25, 30]),
      ...feed(counter, [30, 30, 30, 30, 30], OCCLUDED, 1000),
      ...feed(counter, [30, 30], VISIBLE, 2000),
    ];
    expect(events.filter((e) => e.type === "tracking_paused")).toHaveLength(1);
    expect(events.filter((e) => e.type === "tracking_resumed")).toHaveLength(1);
  });

  it("preserves the rep count across a dropout", () => {
    const counter = createRepCounter(RANGE);
    feed(counter, CLEAN_REP); // rep 1
    feed(counter, [30, 30], OCCLUDED, 1000); // pause
    const after = feed(counter, [25, ...CLEAN_REP], VISIBLE, 2000); // rep 2
    expect(after.filter((e) => e.type === "rep")).toEqual([
      { type: "rep", count: 2 },
    ]);
    expect(counter.getCount()).toBe(2);
  });

  it("does not fabricate a rep when tracking resumes with the arm already raised", () => {
    const counter = createRepCounter(RANGE);
    // Tracking starts (or resumes) at the top: the upward crossing was never
    // observed, so the descent alone must produce nothing.
    const events = feed(counter, [145, 140, 120, 80, 40, 25]);
    expect(events).toEqual([]);
    expect(counter.getCount()).toBe(0);

    // The next full, fully-visible rep counts normally.
    const next = feed(counter, CLEAN_REP, VISIBLE, 1000);
    expect(next).toEqual([
      { type: "range_reached" },
      { type: "rep", count: 1 },
    ]);
  });

  it("treats visibility exactly at the threshold as visible", () => {
    const counter = createRepCounter(RANGE);
    const events = feed(counter, CLEAN_REP, VISIBILITY_THRESHOLD);
    expect(events.filter((e) => e.type === "rep")).toHaveLength(1);
    expect(events.filter((e) => e.type === "tracking_paused")).toHaveLength(0);
  });

  it("emits range_reached once per rep, fresh for each new rep", () => {
    const counter = createRepCounter(RANGE);
    // Rep with top jitter, then a clean rep: each rep gets exactly one
    // range_reached, in order.
    const events = feed(counter, [
      ...[25, 60, 128, 133, 128, 133, 100, 35],
      ...CLEAN_REP,
    ]);
    expect(events).toEqual([
      { type: "range_reached" },
      { type: "rep", count: 1 },
      { type: "range_reached" },
      { type: "rep", count: 2 },
    ]);
  });

  it("counts reps for a high-minimum limited range of motion", () => {
    // Calibrated 120–140° (e.g. limited elbow extension): range-relative
    // thresholds give up = 137, down = 123 — both inside the user's range.
    // The old 0.85 × maxDeg formula put the top threshold at 119°, below
    // the user's minimum, making reps uncountable for exactly the users
    // this app is built for.
    const counter = createRepCounter({ minDeg: 120, maxDeg: 140 });
    const events = feed(counter, [121, 125, 130, 136, 139, 130, 124, 122]);
    expect(events).toEqual([
      { type: "range_reached" },
      { type: "rep", count: 1 },
    ]);
  });

  it("never counts with a degenerate calibration range", () => {
    // maxDeg ≤ minDeg inverts the thresholds; the counter must go silent,
    // not spam phantom reps. Sane ranges are T08 calibration's job.
    const counter = createRepCounter({ minDeg: 110, maxDeg: 100 });
    const events = feed(counter, [105, 108, 103, 107, 102, 106, 104]);
    expect(events.filter((e) => e.type === "rep")).toHaveLength(0);
  });

  it("never counts with a zero-width calibration range", () => {
    // minDeg === maxDeg collapses both thresholds to the same angle. Without
    // the explicit span <= 0 guard, a single frame jumping from just below
    // to just above that one point (then back down) can fire a full
    // phantom rep for a user whose calibration showed zero measurable
    // motion — exactly the failure this app must never inflict.
    const counter = createRepCounter({ minDeg: 90, maxDeg: 90 });
    const events = feed(counter, [89, 91, 89, 91, 89]);
    expect(events).toEqual([]);
    expect(counter.getCount()).toBe(0);
  });
});
