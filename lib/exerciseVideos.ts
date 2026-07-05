// Exercise demo clips live in public/graphics/<name>.{webm,mp4} (generated from
// the source GIFs by scripts/generate-exercise-video.mjs). A few clip file
// names differ from the exercise id, so the mapping lives here in one place —
// not on the Exercise record, since it isn't a DB column (Section 4). The value
// is the base path (no extension); the player and library append the format.

export const EXERCISE_VIDEO_BY_ID: Record<string, string> = {
  seated_lateral_raise: "/graphics/seated_lateral_raise",
  seated_band_row: "/graphics/seated_resistance_band_row",
  seated_march: "/graphics/seated_march",
  seated_shoulder_shrugs: "/graphics/seated_shoulder_shrugs",
  seated_ankle_circles: "/graphics/seated_ankle_circles",
  seated_torso_twist: "/graphics/chair_pilates",
  wall_pushup: "/graphics/wall_or_incline",
  lying_knee_to_chest: "/graphics/lying_knee_stretch",
  lying_band_chest_press: "/graphics/lying_band_chest_press",
  lying_heel_slides: "/graphics/lying_heel_slides",
  wheelchair_pushing: "/graphics/wheelchair_pushing",
  // Second set — filenames already match the exercise id.
  isometric_glute_contraction: "/graphics/isometric_glute_contraction",
  seated_arm_circles: "/graphics/seated_arm_circles",
  seated_band_chest_press: "/graphics/seated_band_chest_press",
  seated_band_overhead_pull: "/graphics/seated_band_overhead_pull",
  seated_band_pull_apart: "/graphics/seated_band_pull_apart",
  seated_band_shoulder_rotation: "/graphics/seated_band_shoulder_rotation",
  seated_bicep_curl: "/graphics/seated_bicep_curl",
  seated_boxer_punches: "/graphics/seated_boxer_punches",
  seated_forward_fold: "/graphics/seated_forward_fold",
  seated_heel_raises: "/graphics/seated_heel_raises",
  seated_knee_extension: "/graphics/seated_knee_extension",
  seated_neck_stretch: "/graphics/seated_neck_stretch",
  seated_overhead_press: "/graphics/seated_overhead_press",
  seated_side_bend: "/graphics/seated_side_bend",
  seated_wrist_rolls: "/graphics/seated_wrist_rolls",
};

/** Base path of an exercise's demo clip, or null when it has none. */
export function getExerciseVideoUrl(exerciseId: string): string | null {
  return EXERCISE_VIDEO_BY_ID[exerciseId] ?? null;
}
