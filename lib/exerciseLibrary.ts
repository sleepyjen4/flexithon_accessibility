import type {
  BodyRegion,
  Equipment,
  Exercise,
  ExerciseCategory,
  Position,
} from "@/types";
import {
  EQUIPMENT_LABELS,
  EXERCISES,
  EXERCISE_CATEGORY_LABELS,
  POSITION_LABELS,
} from "@/lib/exercises";

const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  back: "Back",
  lower_back: "Lower back",
  hips: "Hips",
  legs: "Legs",
  neck: "Neck",
};

const POSITIONS: Position[] = ["lying", "seated", "standing"];
const EQUIPMENT: Equipment[] = [
  "none",
  "chair",
  "wall",
  "resistance_band",
  "dumbbell",
  "wheelchair",
  "bench",
  "ankle_weights",
  "support_surface",
  "mobility_aid",
  "pool_access",
  "gripper_putty",
];
const BODY_REGIONS: BodyRegion[] = [
  "shoulders",
  "arms",
  "core",
  "back",
  "lower_back",
  "hips",
  "legs",
  "neck",
];
const CATEGORIES: ExerciseCategory[] = [
  "strength",
  "cardio",
  "flexibility",
  "core",
  "balance",
];

export type ExerciseLibraryGroupId =
  | "position"
  | "equipment"
  | "body-region"
  | "category";

export interface MetadataCard {
  id: string;
  label: string;
  count: number;
  href: string;
}

export interface MetadataRow {
  id: ExerciseLibraryGroupId;
  label: string;
  cards: MetadataCard[];
}

function countByValue<T extends string>(
  values: T[],
  matches: (exercise: Exercise, value: T) => boolean,
): Map<T, number> {
  return new Map(
    values.map((value) => [
      value,
      EXERCISES.filter((exercise) => matches(exercise, value)).length,
    ]),
  );
}

function cardsFromRecord<T extends string>(
  group: ExerciseLibraryGroupId,
  values: T[],
  labels: Record<T, string>,
  counts: Map<T, number>,
): MetadataCard[] {
  return values.map((value) => ({
    id: value,
    label: labels[value],
    count: counts.get(value) ?? 0,
    href: `/library/${group}/${value}`,
  }));
}

export const metadataRows: MetadataRow[] = [
  {
    id: "position",
    label: "Position",
    cards: cardsFromRecord(
      "position",
      POSITIONS,
      POSITION_LABELS,
      countByValue(POSITIONS, (exercise, value) =>
        exercise.positions.includes(value),
      ),
    ),
  },
  {
    id: "equipment",
    label: "Equipment",
    cards: cardsFromRecord(
      "equipment",
      EQUIPMENT,
      EQUIPMENT_LABELS,
      countByValue(EQUIPMENT, (exercise, value) =>
        exercise.equipment.includes(value),
      ),
    ),
  },
  {
    id: "body-region",
    label: "Body region",
    cards: cardsFromRecord(
      "body-region",
      BODY_REGIONS,
      BODY_REGION_LABELS,
      countByValue(BODY_REGIONS, (exercise, value) =>
        exercise.body_regions.includes(value),
      ),
    ),
  },
  {
    id: "category",
    label: "Category",
    cards: cardsFromRecord(
      "category",
      CATEGORIES,
      EXERCISE_CATEGORY_LABELS,
      countByValue(CATEGORIES, (exercise, value) =>
        exercise.category === value,
      ),
    ),
  },
];

export function getLibraryRow(groupId: string): MetadataRow | undefined {
  return metadataRows.find((row) => row.id === groupId);
}

export function getLibraryCard(
  groupId: string,
  valueId: string,
): MetadataCard | undefined {
  return getLibraryRow(groupId)?.cards.find((card) => card.id === valueId);
}

export function filterExercisesByLibraryCard(
  groupId: ExerciseLibraryGroupId,
  valueId: string,
): Exercise[] {
  return EXERCISES.filter((exercise) => {
    switch (groupId) {
      case "position":
        return exercise.positions.includes(valueId as Position);
      case "equipment":
        return exercise.equipment.includes(valueId as Equipment);
      case "body-region":
        return exercise.body_regions.includes(valueId as BodyRegion);
      case "category":
        return exercise.category === valueId;
    }
  });
}

export function getLibraryStaticParams() {
  return metadataRows.flatMap((row) =>
    row.cards.map((card) => ({
      group: row.id,
      value: card.id,
    })),
  );
}
