import type { PersonalRange } from "@/types";
import { UP_THRESHOLD_FRACTION } from "@/lib/pose/repCounter";

interface RangeArcProps {
  /** Live smoothed joint angle, or null when tracking is paused / out of view. */
  currentAngle: number | null;
  /** Best angle reached so far this session. */
  peakAngle: number;
  /** The user's calibrated range this arc is scored against. */
  range: PersonalRange;
  className?: string;
}

// Gauge geometry: a 180° arc above the baseline. f = 0 sits at the left
// (calibrated minimum), f = 1 at the right (calibrated maximum).
const CENTER_X = 100;
const CENTER_Y = 104;
const RADIUS = 84;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Fraction (0–1) of the way through the personal range for a given angle. */
function fractionFor(angle: number, range: PersonalRange): number {
  const span = Math.max(1, range.maxDeg - range.minDeg);
  return clamp01((angle - range.minDeg) / span);
}

/** Point on the gauge arc for fraction f, at the given radius. */
function pointOnArc(fraction: number, radius: number): { x: number; y: number } {
  const theta = (1 - fraction) * Math.PI; // f=0 → 180° (left), f=1 → 0° (right)
  return {
    x: CENTER_X + radius * Math.cos(theta),
    y: CENTER_Y - radius * Math.sin(theta),
  };
}

/** SVG arc path from fraction f0 to f1 (f1 ≥ f0), bulging over the top. */
function arcPath(f0: number, f1: number, radius: number): string {
  const start = pointOnArc(f0, radius);
  const end = pointOnArc(f1, radius);
  // Sweep-flag 1 (clockwise on screen in SVG's y-down space) draws the arc from
  // the left/min point over the TOP toward the right/max point; the span is
  // never more than 180°, so large-arc-flag is always 0.
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

export function RangeArc({
  currentAngle,
  peakAngle,
  range,
  className,
}: RangeArcProps) {
  const targetFraction = UP_THRESHOLD_FRACTION;
  const target = pointOnArc(targetFraction, RADIUS);
  const targetOuter = pointOnArc(targetFraction, RADIUS + 12);
  const targetInner = pointOnArc(targetFraction, RADIUS - 12);

  const currentFraction =
    currentAngle === null ? null : fractionFor(currentAngle, range);
  const currentPoint =
    currentFraction === null ? null : pointOnArc(currentFraction, RADIUS);

  const peakFraction = fractionFor(peakAngle, range);
  const peakReachedTarget = peakFraction >= targetFraction;

  // Rendered inside the dark camera stage, so colors come from the dark end of
  // the token set: raspberry-bright progress, marigold markers, milk read-out.
  return (
    <figure
      className={`rounded-2xl bg-white/5 p-4 text-center ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 200 128"
        className="mx-auto h-auto w-full max-w-70"
        aria-hidden="true"
      >
        {/* Full personal-range track */}
        <path
          d={arcPath(0, 1, RADIUS)}
          fill="none"
          stroke="#4a4438"
          strokeWidth={14}
          strokeLinecap="round"
        />

        {/* Progress from minimum up to the current angle */}
        {currentFraction !== null && currentFraction > 0 ? (
          <path
            d={arcPath(0, currentFraction, RADIUS)}
            fill="none"
            stroke="#e8798f"
            strokeWidth={14}
            strokeLinecap="round"
          />
        ) : null}

        {/* Target marker — the point a rep must reach (0.85 of your range) */}
        <line
          x1={targetInner.x}
          y1={targetInner.y}
          x2={targetOuter.x}
          y2={targetOuter.y}
          stroke={peakReachedTarget ? "#7ec8a8" : "#d6ccbb"}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle
          cx={target.x}
          cy={target.y}
          r={4}
          fill={peakReachedTarget ? "#7ec8a8" : "#d6ccbb"}
        />

        {/* Peak-so-far marker */}
        {peakFraction > 0 ? (
          <circle
            cx={pointOnArc(peakFraction, RADIUS).x}
            cy={pointOnArc(peakFraction, RADIUS).y}
            r={6}
            fill="none"
            stroke="#e5a83c"
            strokeWidth={3}
          />
        ) : null}

        {/* Live position dot */}
        {currentPoint ? (
          <circle cx={currentPoint.x} cy={currentPoint.y} r={8} fill="#e8798f" />
        ) : null}

        {/* Center read-out. Explicit fill attributes (not Tailwind fill-*
            classes) so the text colours are reliable on SVG across browsers. */}
        <text
          x={CENTER_X}
          y={CENTER_Y - 18}
          textAnchor="middle"
          fill="#fff9ee"
          fontSize={30}
          fontWeight={700}
        >
          {currentAngle === null ? "—" : `${Math.round(currentAngle)}°`}
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y}
          textAnchor="middle"
          fill="#d6ccbb"
          fontSize={11}
        >
          of {Math.round(range.maxDeg)}° range
        </text>
      </svg>

      <figcaption className="mt-1 text-sm font-medium text-milk-soft">
        {peakReachedTarget
          ? "You're reaching your target range."
          : "The mark shows your target — move toward it at your own pace."}
      </figcaption>
    </figure>
  );
}
