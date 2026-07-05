/**
 * Non-exercise lines the workout player speaks (Section 5c). These are
 * pre-generated into static clips by scripts/generate-audio.ts using the same
 * warm Google AI Studio voice as the exercise instructions.
 *
 * This map is the single source of truth for the wording: the build script
 * synthesizes exactly this text, and the player passes the same text as the
 * Web Speech fallback — so the pre-generated clip and the fallback are
 * interchangeable and never drift.
 */
export const STATIC_CLIPS = {
  rest: "Time to rest. Take your time — the next exercise waits for you.",
  // Calibration intro read-aloud (CalibrationFlow "What happens" list), one per
  // calibrated movement. The wording MUST stay in sync with the on-screen list
  // — poseDef.instructions plus the fixed opening and closing lines — so the
  // clip and the Web Speech fallback read exactly what's shown.
  calibrate_seated_arm_raise:
    "Here's what happens. Sit so your head and arms are in view. Sit in a supported position. Raise one arm toward a comfortable range. Lower your arm when you are ready. Repeat gently 3 times. We'll do the measuring.",
  calibrate_seated_bicep_curl:
    "Here's what happens. Sit so your head and arms are in view. Sit tall with your arm relaxed at your side. Bend your elbow to bring your hand toward your shoulder. Lower slowly with control. Repeat gently 3 times. We'll do the measuring.",
} as const;

export type StaticClipId = keyof typeof STATIC_CLIPS;
