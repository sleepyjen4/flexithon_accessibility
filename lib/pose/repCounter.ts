import type { PersonalRange, PoseFrame, RepEvent } from "@/types";

/**
 * Frames with landmark visibility below this are ignored and counting pauses
 * silently (TICKETS.md T06; AGENTS.md §5b — never imply the user's body or
 * setup is the problem).
 */
export const VISIBILITY_THRESHOLD = 0.6;

/** A rep's top threshold: angle must cross above 0.85 × maxDeg. */
export const UP_THRESHOLD_FRACTION = 0.85;

/** A rep's bottom threshold: angle must return below minDeg + 0.15 × range. */
export const DOWN_THRESHOLD_FRACTION = 0.15;

type Phase = "idle" | "rising" | "peaked" | "falling";

export interface RepCounter {
  /**
   * Feed one smoothed pose frame; returns the events it produced (usually
   * none). Deterministic and side-effect free apart from internal state.
   */
  update(frame: PoseFrame): RepEvent[];
  getCount(): number;
}

/**
 * Hysteresis rep counter (T06). A rep counts only when the angle crosses
 * up past `UP_THRESHOLD_FRACTION * maxDeg`, then back down below
 * `minDeg + DOWN_THRESHOLD_FRACTION * range` — jitter around a single
 * threshold can never double-count. Threshold math intentionally matches
 * mockProvider.ts so the T11 provider swap is behavior-compatible.
 *
 * Differences from the mock, required by the T06 acceptance criteria:
 * - Visibility dropout resets the in-flight rep (count is preserved), so a
 *   movement that spans a tracking gap is never counted from motion nobody
 *   observed.
 * - The top crossing must be seen happening (previous visible frame below
 *   the threshold, current frame above). Resuming tracking with the arm
 *   already at the top cannot fabricate a rep or range_reached.
 *
 * Degenerate calibration (maxDeg ≤ minDeg, or a range so narrow the
 * thresholds invert) simply never counts — it cannot spam phantom reps.
 * T08's calibration flow is responsible for producing sane ranges.
 */
export function createRepCounter(range: PersonalRange): RepCounter {
  const upThreshold = UP_THRESHOLD_FRACTION * range.maxDeg;
  const downThreshold =
    range.minDeg + DOWN_THRESHOLD_FRACTION * (range.maxDeg - range.minDeg);

  let phase: Phase = "idle";
  let count = 0;
  let paused = false;
  let rangeReachedThisRep = false;
  /** Last angle seen while tracking; null before the first visible frame and after every pause. */
  let previousAngle: number | null = null;

  function crossedUp(threshold: number, angle: number): boolean {
    return (
      previousAngle !== null && previousAngle < threshold && angle >= threshold
    );
  }

  function update(frame: PoseFrame): RepEvent[] {
    const events: RepEvent[] = [];

    if (frame.visibility < VISIBILITY_THRESHOLD) {
      if (!paused) {
        paused = true;
        phase = "idle";
        rangeReachedThisRep = false;
        previousAngle = null;
        events.push({ type: "tracking_paused" });
      }
      return events;
    }

    if (paused) {
      paused = false;
      events.push({ type: "tracking_resumed" });
    }

    const angle = frame.angleDeg;

    if (previousAngle === null) {
      // First visible frame (start or post-pause): establish a baseline so
      // threshold crossings are only detected between two observed frames.
      previousAngle = angle;
      return events;
    }

    if (phase === "idle" && angle > downThreshold) {
      phase = "rising";
    }

    if (phase === "rising") {
      if (crossedUp(upThreshold, angle)) {
        phase = "peaked";
        if (!rangeReachedThisRep) {
          rangeReachedThisRep = true;
          events.push({ type: "range_reached" });
        }
      } else if (angle <= downThreshold) {
        // Partial rep: never reached the top — no count, no penalty.
        phase = "idle";
      }
    }

    if (phase === "peaked" && angle < upThreshold) {
      phase = "falling";
    }

    if (phase === "falling") {
      if (crossedUp(upThreshold, angle)) {
        // Jitter back over the top within the same rep: no second event.
        phase = "peaked";
      } else if (angle <= downThreshold) {
        count += 1;
        rangeReachedThisRep = false;
        phase = "idle";
        events.push({ type: "rep", count });
      }
    }

    previousAngle = angle;
    return events;
  }

  return { update, getCount: () => count };
}
