export interface AnglePoint {
  x: number;
  y: number;
  visibility?: number;
}

export const MIN_VISIBILITY = 0.6;
export const EMA_ALPHA = 0.3;

/** Angle at `vertex`, between rays vertex->a and vertex->b, in degrees. */
export function jointAngleDegrees(a: AnglePoint, vertex: AnglePoint, b: AnglePoint): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const magnitudes = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (magnitudes === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / magnitudes))) * 180) / Math.PI;
}

/**
 * Angle at `vertex`, or null if any of the three landmarks' visibility is
 * below threshold — callers should pause counting silently rather than
 * show an error implying the user's body or setup is the problem.
 */
export function visibleJointAngleDegrees(
  a: AnglePoint,
  vertex: AnglePoint,
  b: AnglePoint,
  minVisibility: number = MIN_VISIBILITY,
): number | null {
  if ([a, vertex, b].some((point) => (point.visibility ?? 0) < minVisibility)) {
    return null;
  }
  return jointAngleDegrees(a, vertex, b);
}

/** One step of an exponential moving average; pass `prev = null` to seed with `next`. */
export function emaStep(prev: number | null, next: number, alpha: number = EMA_ALPHA): number {
  return prev === null ? next : prev + alpha * (next - prev);
}
