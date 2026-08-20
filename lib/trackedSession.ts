import type {
  EnergyLevel,
  SessionSummary,
  WorkoutSessionSummary,
} from "@/types";

/**
 * Maps a finished camera-tracked set onto the shape the progress view reads.
 *
 * Without this, a tracked set existed only in `store/session`: it never reached
 * `store/history`, so /progress showed nothing for anyone who used the camera
 * loop instead of the generated-workout loop. Half the app was invisible to the
 * one screen whose job is showing that you turned up.
 *
 * The id is derived from the exercise and the set's start time rather than
 * randomly generated, so writing the same set twice is a no-op: `addSession`
 * dedupes on id, which makes an effect-on-mount write idempotent across
 * refreshes and back/forward navigation without needing a saved-flag guard.
 */
export function trackedSessionToHistory(
  summary: SessionSummary,
  options: { exerciseName?: string; energy?: EnergyLevel | null } = {},
): WorkoutSessionSummary {
  const peak = Math.round(summary.peakAngleToday);

  return {
    id: `tracked-${summary.exerciseId}-${summary.startedAt}`,
    workout_title: options.exerciseName ?? "Tracked set",
    // A tracked set carries no check-in of its own. Fall back to the middle of
    // the scale rather than inventing a high or low energy day for the user.
    energy_level: options.energy ?? 3,
    completed_steps: 1,
    total_steps: 1,
    // Effort is never asked for on this path, and null is the honest answer.
    // ProgressView omits the effort chip entirely rather than guessing.
    effort: null,
    // Keyed by the same id the calibration store uses, so the range-of-motion
    // readout on /progress picks it up. Omitted when the camera captured
    // nothing, so a manual completion never reports a 0-degree peak.
    peak_rom_degrees: peak > 0 ? { [summary.exerciseId]: peak } : {},
    completed_at: new Date(summary.endedAt).toISOString(),
  };
}
