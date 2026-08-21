import { describe, expect, it } from "vitest";
import { buildWorkout, hasAvailableExercises } from "@/lib/workoutBuilder";
import { HERO_EXERCISE_ID } from "@/lib/exercises";
import type { Abilities, BodyRegion, EnergyLevel } from "@/types";

const ALL_REGIONS: BodyRegion[] = [
  "neck",
  "shoulders",
  "arms",
  "back",
  "lower_back",
  "core",
  "hips",
  "legs",
];

function profile(overrides: Partial<Abilities> = {}): Abilities {
  return {
    positions: ["seated", "lying"],
    equipment: ["none", "chair", "wall"],
    avoid_regions: [],
    sensory: { captions: true, reduced_motion: false, haptics: false },
    ...overrides,
  };
}

describe("buildWorkout", () => {
  it("never returns a workout with zero steps", () => {
    // The bug this guards: an empty step list read as "already finished", so
    // the player congratulated the user on a workout that never existed.
    for (const energy of [1, 2, 3, 4, 5] as EnergyLevel[]) {
      for (const avoid of [[], ["shoulders"], ALL_REGIONS.slice(0, 7)] as BodyRegion[][]) {
        const result = buildWorkout({
          abilities: profile({ avoid_regions: avoid }),
          energy,
        });
        if (result.ok) expect(result.workout.steps.length).toBeGreaterThan(0);
      }
    }
  });

  it("reports the empty library instead of building a stepless workout", () => {
    const result = buildWorkout({
      abilities: profile({ avoid_regions: ALL_REGIONS }),
      energy: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_exercises_available");
  });

  it("is deterministic, so /workout can rebuild instead of persisting", () => {
    const abilities = profile();
    const first = buildWorkout({ abilities, energy: 2 });
    const second = buildWorkout({ abilities, energy: 2 });

    expect(first).toEqual(second);
  });

  it("scales the plan by energy", () => {
    const abilities = profile();
    const low = buildWorkout({ abilities, energy: 2 });
    const high = buildWorkout({ abilities, energy: 5 });

    if (!low.ok || !high.ok) throw new Error("expected both profiles to build");

    expect(low.workout.steps.length).toBeLessThan(high.workout.steps.length);
    expect(low.workout.steps[0].rest_after_seconds).toBeGreaterThan(
      high.workout.steps[0].rest_after_seconds,
    );
    expect(low.workout.title).not.toBe(high.workout.title);
  });

  it("includes the camera hero exercise when the profile allows it", () => {
    const result = buildWorkout({ abilities: profile(), energy: 3 });

    if (!result.ok) throw new Error("expected a workout");
    expect(result.workout.steps.map((step) => step.exercise_id)).toContain(
      HERO_EXERCISE_ID,
    );
  });
});

describe("hasAvailableExercises", () => {
  it("is false exactly when buildWorkout cannot build", () => {
    const empty = profile({ avoid_regions: ALL_REGIONS });
    const usable = profile();

    expect(hasAvailableExercises(empty)).toBe(false);
    expect(hasAvailableExercises(usable)).toBe(true);
    expect(buildWorkout({ abilities: empty, energy: 3 }).ok).toBe(false);
    expect(buildWorkout({ abilities: usable, energy: 3 }).ok).toBe(true);
  });
});
