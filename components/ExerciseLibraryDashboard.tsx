import type {
  BodyRegion,
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseMetric,
  Position,
  TrackingMode,
} from "@/types";
import { Card } from "@/components/Card";
import {
  EQUIPMENT_LABELS,
  EXERCISES,
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_METRIC_LABELS,
  POSITION_LABELS,
  TRACKING_MODE_LABELS,
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
const TRACKING_MODES: TrackingMode[] = ["camera_manual", "timer", "manual"];
const METRICS: ExerciseMetric[] = [
  "reps",
  "reps_sets_weight",
  "reps_sets",
  "reps_or_time",
  "reps_per_leg",
  "reps_or_hold_time",
  "reps_or_hold_seconds",
  "session_duration",
  "duration_per_stretch",
  "hold_time_sets",
  "duration_effort",
  "distance_time",
  "laps_duration",
  "time_or_reps",
];
const INTENSITIES: Exercise["intensity"][] = [1, 2, 3, 4, 5];

interface MetadataCard {
  id: string;
  label: string;
  count: number;
}

interface MetadataRow {
  id: string;
  label: string;
  cards: MetadataCard[];
}

function countByValue<T extends string | number>(
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
  values: T[],
  labels: Record<T, string>,
  counts: Map<T, number>,
): MetadataCard[] {
  return values.map((value) => ({
    id: value,
    label: labels[value],
    count: counts.get(value) ?? 0,
  }));
}

const metadataRows: MetadataRow[] = [
  {
    id: "position",
    label: "Position",
    cards: cardsFromRecord(
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
      CATEGORIES,
      EXERCISE_CATEGORY_LABELS,
      countByValue(CATEGORIES, (exercise, value) =>
        exercise.category === value,
      ),
    ),
  },
];

function MetadataValueCard({ card }: { card: MetadataCard }) {
  return (
    <Card className="flex min-h-28 w-40 shrink-0 flex-col justify-between rounded-lg p-4">
      <h3 className="text-lg font-bold text-slate-900">{card.label}</h3>
      <p className="text-base font-medium text-slate-600">
        {card.count} {card.count === 1 ? "exercise" : "exercises"}
      </p>
    </Card>
  );
}

export function ExerciseLibraryDashboard() {
  return (
    <div className="flex flex-col gap-8">
      {metadataRows.map((row) => (
        <section key={row.id} aria-labelledby={`${row.id}-heading`}>
          <h2
            id={`${row.id}-heading`}
            className="mb-3 text-2xl font-bold text-slate-900"
          >
            {row.label}
          </h2>
          <div
            className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2"
            aria-label={`${row.label} options`}
          >
            {row.cards.map((card) => (
              <MetadataValueCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
