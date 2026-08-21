import { describe, expect, it } from "vitest";
import { buildWorkout, hasAvailableExercises } from "@/lib/workoutBuilder";
import {
  EXERCISES,
  HERO_EXERCISE_ID,
  getExerciseById,
  intensityCeilingForEnergy,
} from "@/lib/exercises";
import type { Abilities, BodyRegion, EnergyLevel, Equipment } from "@/types";

const ENERGIES: EnergyLevel[] = [1, 2, 3, 4, 5];

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

  it("gives every energy level its own plan, length and title", () => {
    // 4/4/5/6/6 with two timing pairs gave five levels three plans: energy 1
    // and 2 built byte-identical workouts, as did 4 and 5, and energy 1-3 all
    // estimated six minutes. The check-in changing the workout is the whole
    // point of the check-in.
    const abilities = profile();
    const built = ENERGIES.map((energy) => {
      const result = buildWorkout({ abilities, energy });
      if (!result.ok) throw new Error(`expected energy ${energy} to build`);
      return result.workout;
    });

    for (const key of ["steps", "estimated_minutes", "title"] as const) {
      const values = built.map((workout) =>
        key === "steps" ? workout.steps.length : workout[key],
      );
      expect(new Set(values).size).toBe(ENERGIES.length);
    }

    // Session length must rise monotonically. It used to fall per step
    // (90s to 75s) because rest shrank exactly as work grew.
    const seconds = built.map(
      (workout) =>
        workout.steps.length *
        (workout.steps[0].duration_seconds +
          workout.steps[0].rest_after_seconds),
    );
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
  });

  it("reaches harder work as energy rises rather than more of the gentlest", () => {
    // Selection took the N gentlest, so raising energy only appended more
    // intensity-1 stretches: average intensity *fell* from 1.25 at energy 1 to
    // 1.17 at energy 5, and the library's intensity-3 and intensity-4
    // exercises were unreachable at every level.
    const abilities = profile({ equipment: ["none", "chair", "resistance_band"] });
    const averages = ENERGIES.map((energy) => {
      const result = buildWorkout({ abilities, energy });
      if (!result.ok) throw new Error(`expected energy ${energy} to build`);

      const intensities: number[] = result.workout.steps.map(
        (step) => getExerciseById(step.exercise_id)?.intensity ?? 0,
      );
      // The hero is the one exercise allowed past the ceiling, so F9 always
      // has somewhere to attach.
      for (const step of result.workout.steps) {
        const exercise = getExerciseById(step.exercise_id);
        if (!exercise || exercise.id === HERO_EXERCISE_ID) continue;
        expect(exercise.intensity).toBeLessThanOrEqual(
          intensityCeilingForEnergy(energy),
        );
      }
      return intensities.reduce((a, b) => a + b, 0) / intensities.length;
    });

    expect(averages[4]).toBeGreaterThan(averages[0]);
    expect(averages).toEqual([...averages].sort((a, b) => a - b));
  });

  it("never puts a log-only activity in the player", () => {
    // Swimming, pushing a wheelchair and walking with an aid are logged after
    // the fact: no demo clip, no timed instructions. They are also the
    // library's highest-intensity entries, so filling from the hard end of the
    // range reaches them first — 1917 plans did before this filter, and 168
    // did even under the old gentlest-first selection.
    const equipment: Equipment[] = [
      "none",
      "wheelchair",
      "mobility_aid",
      "pool_access",
      "resistance_band",
      "chair",
    ];

    for (const item of equipment) {
      for (const positions of [["seated"], ["standing"], ["lying"]] as Abilities["positions"][]) {
        for (const energy of ENERGIES) {
          const result = buildWorkout({
            abilities: profile({ positions, equipment: [item] }),
            energy,
          });
          if (!result.ok) continue;

          for (const step of result.workout.steps) {
            expect(getExerciseById(step.exercise_id)?.interaction_group).not.toBe(
              "manual_entry",
            );
          }
        }
      }
    }
  });

  it("still builds for a profile whose only match is log-only", () => {
    // Standing + pool access matches swimming and nothing else. Filtering it
    // out must report the empty library, not hand the player a stepless
    // workout it would celebrate as finished.
    const abilities = profile({
      positions: ["standing"],
      equipment: ["pool_access"],
    });
    const matches = EXERCISES.filter(
      (exercise) =>
        exercise.positions.includes("standing") &&
        exercise.equipment.includes("pool_access"),
    );

    expect(matches.every((e) => e.interaction_group === "manual_entry")).toBe(true);
    expect(buildWorkout({ abilities, energy: 5 }).ok).toBe(false);
    expect(hasAvailableExercises(abilities)).toBe(false);
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
