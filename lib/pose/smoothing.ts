/**
 * Default EMA smoothing factor for joint angles (AGENTS.md §5b). Tremor
 * users may need a lower value (~0.15) for heavier smoothing at the cost of
 * slower response to real movement — keep this tunable, not hardcoded
 * elsewhere.
 */
export const DEFAULT_ALPHA = 0.3;

/**
 * One step of exponential moving average smoothing. Pass `previous = null`
 * for the first sample of a stream (e.g. after a tracking pause/resume) so
 * it seeds the average instead of blending against a stale value.
 */
export function smoothWithEma(
  previous: number | null,
  sample: number,
  alpha: number = DEFAULT_ALPHA
): number {
  if (previous === null) return sample;
  return alpha * sample + (1 - alpha) * previous;
}
