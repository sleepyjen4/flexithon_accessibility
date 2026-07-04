/**
 * A single 2D point. Structurally compatible with MediaPipe's
 * NormalizedLandmark (which also carries z/visibility) — pass landmarks
 * straight in without mapping them first.
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Angle in degrees at vertex `b`, formed by rays b->a and b->c, computed via
 * atan2 (stays well-defined for vertical rays / zero-length axes, unlike a
 * dot-product + acos approach). Always returns a value in [0, 180].
 *
 * Points must share an isotropic scale. MediaPipe normalizes x and y to the
 * frame independently, so on a non-square video raw normalized landmarks
 * distort angles — callers must aspect-correct first (e.g.
 * `x * videoWidth / videoHeight`) or convert to pixels.
 */
export function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const angleA = Math.atan2(a.y - b.y, a.x - b.x);
  const angleC = Math.atan2(c.y - b.y, c.x - b.x);

  let angleDeg = Math.abs(angleA - angleC) * (180 / Math.PI);
  if (angleDeg > 180) angleDeg = 360 - angleDeg;

  return angleDeg;
}
