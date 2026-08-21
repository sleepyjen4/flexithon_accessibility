import { describe, expect, it } from "vitest";
import { trackedSessionToHistory } from "@/lib/trackedSession";
import type { SessionSummary } from "@/types";

const base: SessionSummary = {
  exerciseId: "seated_lateral_raise",
  reps: 8,
  personalRange: { minDeg: 15, maxDeg: 95 },
  peakAngleToday: 88.4,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_180_000,
};

describe("trackedSessionToHistory", () => {
  it("derives a stable id so re-saving the same set is a no-op", () => {
    expect(trackedSessionToHistory(base).id).toBe(
      trackedSessionToHistory(base).id,
    );
  });

  it("gives different sets different ids", () => {
    const later = { ...base, startedAt: base.startedAt + 1 };
    expect(trackedSessionToHistory(base).id).not.toBe(
      trackedSessionToHistory(later).id,
    );
  });

  it("keys peak range of motion by exercise id so /progress can chart it", () => {
    expect(trackedSessionToHistory(base).peak_rom_degrees).toEqual({
      seated_lateral_raise: 88,
    });
  });

  it("records no range at all when the camera captured nothing", () => {
    const manual = { ...base, peakAngleToday: 0 };
    expect(trackedSessionToHistory(manual).peak_rom_degrees).toEqual({});
  });

  it("leaves effort null rather than inventing one — it is never asked here", () => {
    expect(trackedSessionToHistory(base).effort).toBeNull();
  });

  it("falls back to mid-scale energy when the day has no check-in", () => {
    expect(trackedSessionToHistory(base).energy_level).toBe(3);
    expect(trackedSessionToHistory(base, { energy: 5 }).energy_level).toBe(5);
    expect(trackedSessionToHistory(base, { energy: null }).energy_level).toBe(3);
  });

  it("counts the set as one completed step of one", () => {
    const result = trackedSessionToHistory(base);
    expect(result.completed_steps).toBe(1);
    expect(result.total_steps).toBe(1);
  });

  it("uses the set's end time as the completion timestamp", () => {
    expect(trackedSessionToHistory(base).completed_at).toBe(
      new Date(base.endedAt).toISOString(),
    );
  });

  it("names the session after the exercise when one is known", () => {
    expect(
      trackedSessionToHistory(base, { exerciseName: "Seated lateral raise" })
        .workout_title,
    ).toBe("Seated lateral raise");
    expect(trackedSessionToHistory(base).workout_title).toBe("Tracked set");
  });
});
