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
    // Left shoulder(11)-elbow(13)-wrist(15): confirmed against the T01/T05 spike.
    landmarks: [11, 13, 15],
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
    id: "seated_torso_twist",
    name: "Seated torso twist",
    // Left shoulder(11)-right shoulder(12)-left hip(23): the shoulder-line-to
    // -torso angle at the shoulder shifts as the torso rotates. Proposed, not
    // yet confirmed live — rotation is an out-of-plane movement a single 2D
    // camera can only approximate, so re-check this against a real torso
    // twist on `/spike` before relying on it for counting (T10's own AC).
    landmarks: [11, 12, 23],
    side: "either",
    // TODO(T04): placeholder copy — replace with the approved T04 copy deck
    // (distinct per-exercise instructions + cues, reviewed by C for tone).
    instructions: [
      "Sit tall, feet flat on the floor.",
      "Cross your arms over your chest, or rest hands on your shoulders.",
      "Rotate your torso gently side to side.",
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

export function getPoseExerciseById(
  id: ExerciseDef["id"],
): ExerciseDef | undefined {
  return POSE_EXERCISES.find((exercise) => exercise.id === id);
}
