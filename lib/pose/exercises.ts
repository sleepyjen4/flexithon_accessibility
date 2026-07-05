import type { ExerciseDef } from "@/types";

/**
 * T10: the two hero exercises for hands-free tracking (Section 5b), each
 * paired with a landmark triple confirmed against the live spike
 * (`app/spike/page.tsx`) before being trusted for real rep counting.
 */
export const POSE_EXERCISES: ExerciseDef[] = [
  {
    id: "seated_arm_raise",
    name: "Seated arm raise",
    // Angle vertex is the MIDDLE index (angles.ts). Elbow(13)-shoulder(11)-hip(23)
    // measures the angle AT THE SHOULDER, which is what changes as the arm raises.
    // [11,13,15] (vertex=elbow) was wrong — it measures elbow flexion, ~unchanged
    // by a straight-arm raise. This matches the calibration branch (425b5a0).
    landmarks: [13, 11, 23],
    side: "either",
    // TODO(T04): placeholder copy — replace with the approved T04 copy deck
    // (distinct per-exercise instructions + cues, reviewed by C for tone).
    instructions: [
      "Sit in a supported position.",
      "Raise one arm toward a comfortable range.",
      "Lower your arm when you are ready.",
    ],
    cues: {
      rangeReached: "You reached your target range.",
      encourage: [
        "Move within today’s comfortable range.",
        "Pause whenever you need.",
      ],
    },
  },
  {
    id: "seated_bicep_curl",
    name: "Seated bicep curl",
    // Shoulder(11)-elbow(13)-wrist(15): the angle AT THE ELBOW. Unlike the torso
    // twist it replaced (axial rotation is invisible to a 2D camera as a joint
    // angle — confirmed dead on the live spike), elbow flexion is a clean,
    // in-plane signal that swings widely as the forearm curls. Left-side triple;
    // mirrors to the right (14/16). Counting inverts it to a flexion angle so
    // "more effort" reads as a higher value — see usesInvertedAngle below.
    landmarks: [11, 13, 15],
    side: "either",
    instructions: [
      "Sit tall with your arm relaxed at your side.",
      "Bend your elbow to bring your hand toward your shoulder.",
      "Lower slowly with control.",
    ],
    cues: {
      rangeReached: "You reached your target range.",
      encourage: [
        "Move within today’s comfortable range.",
        "Pause whenever you need.",
      ],
    },
  },
];

/**
 * Some movements peak at a LARGER joint angle (the arm raise — shoulder
 * abduction opens the angle), others at a SMALLER one (the bicep curl — the
 * elbow angle closes as you flex). The rep counter, RangeArc, target and
 * peak-ROM all treat "more effort" as a higher value, so flexing movements are
 * measured as `180 - jointAngle` (the anatomical flexion angle: straight ≈ 0°,
 * fully curled ≈ 140°). This set is the single source of truth for which pose
 * exercises invert, shared by the real provider and the calibration flow so the
 * two never disagree about which direction a rep goes.
 */
const INVERTED_ANGLE_IDS: ReadonlySet<ExerciseDef["id"]> = new Set([
  "seated_bicep_curl",
]);

export function usesInvertedAngle(id: ExerciseDef["id"]): boolean {
  return INVERTED_ANGLE_IDS.has(id);
}

export function getPoseExerciseById(
  id: ExerciseDef["id"],
): ExerciseDef | undefined {
  return POSE_EXERCISES.find((exercise) => exercise.id === id);
}

/**
 * Calibrated ranges (T08) are stored under the workout-library id, not the pose
 * def id — the arm raise is `seated_lateral_raise` in the library but
 * `seated_arm_raise` here (a known two-namespace wart, AGENTS.md §4). Every
 * consumer keys ranges through this map so the exercise screen and the
 * calibration flow always read and write the same slot.
 */
export const CALIBRATION_KEY_BY_POSE_ID: Record<ExerciseDef["id"], string> = {
  seated_arm_raise: "seated_lateral_raise",
  seated_bicep_curl: "seated_bicep_curl",
};

/**
 * MediaPipe Pose numbers left/right upper-body landmarks in adjacent pairs, so
 * one physical side mirrors to the other by swapping each index for its twin
 * (T13, single-limb support). Only the upper-body points the tracker uses are
 * listed — lower-body landmarks are unreliable for seated users and never
 * tracked (AGENTS.md §5b).
 */
const MIRROR_LANDMARK_INDEX: Readonly<Record<number, number>> = {
  11: 12, // shoulders
  12: 11,
  13: 14, // elbows
  14: 13,
  15: 16, // wrists
  16: 15,
  23: 24, // hips (anchor only)
  24: 23,
};

/**
 * Mirrors an angle triple to the opposite side of the body. A landmark with no
 * left/right twin (none are tracked today, but e.g. the nose is index 0) is
 * left untouched, so a partially-central triple still resolves sensibly.
 */
export function mirrorLandmarkTriple(
  landmarks: ExerciseDef["landmarks"],
): ExerciseDef["landmarks"] {
  return landmarks.map((index) => MIRROR_LANDMARK_INDEX[index] ?? index) as [
    number,
    number,
    number,
  ];
}

/**
 * Resolves a pose exercise to a single tracked side for single-limb support
 * (T13). The definitions store the canonical (left-body) triple; `"left"` and
 * `"either"` track it as-is, `"right"` mirrors it to the other side. The result
 * always describes ONE side — we never track and compare both, so a user with a
 * limb difference or one-sided range is measured on the side they actually move
 * (AGENTS.md §5b: no cross-side judgments, ever).
 */
export function poseExerciseForSide(
  exercise: ExerciseDef,
  side: ExerciseDef["side"],
): ExerciseDef {
  if (side === "right") {
    return {
      ...exercise,
      side,
      landmarks: mirrorLandmarkTriple(exercise.landmarks),
    };
  }
  return { ...exercise, side };
}
