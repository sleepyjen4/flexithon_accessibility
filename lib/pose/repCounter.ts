import type { PersonalRange, PoseFrame, RepEvent } from "@/types";

/**
 * Demo-condition landmark confidence gate (T15). Venue-like dim lighting and
 * side-angle tests often place one wrist/elbow around 0.5–0.6 even while the
 * movement is visible; 0.5 keeps those reps countable, while lower values let
 * occluded joints create noisy angles. Frames below this still pause counting
 * silently (AGENTS.md §5b — never imply the user's body or setup is the
 * problem).
 */
export const VISIBILITY_THRESHOLD = 0.5;

/** A rep's top threshold: angle must cross above minDeg + 0.85 × range. */
export const UP_THRESHOLD_FRACTION = 0.85;

/** A rep's bottom threshold: angle must return below minDeg + 0.15 × range. */
export const DOWN_THRESHOLD_FRACTION = 0.15;

/**
 * Derives the up/down angle thresholds from a calibrated range. Exported so
 * mockProvider.ts (and any future consumer) computes the identical values
 * instead of re-deriving the fractions — two independent copies of this
 * formula is exactly how the original `0.85 × maxDeg` bug went unnoticed in
 * one file while being fixed in the other.
 *
 * Returns plain floats (no rounding) — callers compare against smoothed
 * angleDeg values that are themselves fractional, so rounding here would
 * only lose precision without changing correctness.
 */
export function computeThresholds(range: PersonalRange): {
  up: number;
  down: number;
} {
  const span = range.maxDeg - range.minDeg;
  return {
    up: range.minDeg + UP_THRESHOLD_FRACTION * span,
    down: range.minDeg + DOWN_THRESHOLD_FRACTION * span,
  };
}

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
 * up past `minDeg + UP_THRESHOLD_FRACTION * range`, then back down below
 * `minDeg + DOWN_THRESHOLD_FRACTION * range` — jitter around a single
 * threshold can never double-count. Threshold math intentionally matches
 * mockProvider.ts so the T11 provider swap is behavior-compatible.
 *
 * Both thresholds are range-relative (85% / 15% of the way through the
 * user's own calibrated range), NOT fractions of the absolute angle. The
 * originally ticketed `0.85 × maxDeg` inverts for high-minimum ranges
 * (e.g. calibrated 120–140° → top threshold 119°, below the user's min),
 * silently ignoring reps from users with limited range of motion — the
 * exact users this app serves.
 *
 * Differences from the mock, required by the T06 acceptance criteria:
 * - Visibility dropout resets the in-flight rep (count is preserved), so a
 *   movement that spans a tracking gap is never counted from motion nobody
 *   observed.
 * - The top crossing must be seen happening (previous visible frame below
 *   the threshold, current frame above). Resuming tracking with the arm
 *   already at the top cannot fabricate a rep or range_reached.
 *
 * Degenerate calibration (maxDeg ≤ minDeg) is guarded explicitly below: a
 * zero-width range collapses both thresholds to the same angle, and a
 * single frame jumping from just below to just above that one point (then
 * back down) can otherwise fire a full phantom rep — for a user whose
 * calibration showed no measurable motion at all. T08's calibration flow
 * should never produce this, but the counter must not depend on that.
 */
export function createRepCounter(range: PersonalRange): RepCounter {
  if (range.maxDeg <= range.minDeg) {
    return { update: () => [], getCount: () => 0 };
  }

  const { up: upThreshold, down: downThreshold } = computeThresholds(range);

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
      // Deliberate: if this frame is already above upThreshold (e.g. camera
      // resumed mid-motion with the arm raised), we still don't emit
      // range_reached here — the crossing itself was never observed, so
      // there's nothing to credit yet. See "does not fabricate a rep when
      // tracking resumes with the arm already raised" in the test file.
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
