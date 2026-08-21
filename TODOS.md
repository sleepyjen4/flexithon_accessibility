# TODOS

## Deferred from the alfa-v2 UI/UX pass (2026-08-20)

### Brand-hover design tokens — the whole 34, not 17
`app/globals.css` defines the warm-paper palette, but four brand states are typed as
raw hex at their call sites instead of existing as tokens:

- `#8f2a47` raspberry pressed (5 sites)
- `#3a332b` ink pressed (6 sites)
- `#173f33` evergreen pressed (1 site)
- `#4f4a78` lavender ink (3 sites)

**Done.** Both halves shipped. The Tailwind-class hexes became four tokens
(`--ink-hover`, `--raspberry-deep`, `--evergreen-deep`, `--lavender-deep`), and
canvas/SVG now resolve tokens at runtime through `lib/canvasPalette.ts` — cached
once, invalidated by a `MutationObserver` on `data-contrast`, so the camera stage
follows high contrast. `RangeArc`'s SVG uses `stroke-*`/`fill-*` utilities instead.

Two colours remain untokenized because they genuinely have no counterpart in the
palette, and both are dark-stage colours the warm-paper system was never designed
for:

- `#4a4438` — the unfilled arc track
- `#7ec8a8` — the target-reached marker

They are hoisted to named constants at the top of `components/RangeArc.tsx` and are
inert under high contrast. Naming them needs a decision about how the dark stage
relates to the palette — `--stage-dim` (added for the dimmed pose skeleton) is the
first token of that kind and is the precedent to follow.

### Information architecture — two loops, one dashboard
Out of scope for a UI/UX pass because it changes product architecture on a team repo,
but recorded because an independent review called it the largest UX defect:

- `components/ExerciseStep.tsx:237` already mounts `PoseTracker` inline, so `/exercise`
  is a second rep-counting surface for the same feature.
- `store/session.ts` is not wrapped in `persist` (unlike `history.ts` and
  `calibration.ts`), so a tracked set does not survive a refresh.
- `addSession` has one call site (`components/WorkoutFinish.tsx:41`), so the camera
  loop never reaches `/progress`.
- `app/exercise/page.tsx:221` writes `recordRom` into the shared session store, which
  `WorkoutFinish.tsx:38` then folds into an unrelated workout's summary.

Unblocked: `alfa-v2` is a personal branch that does not merge to `main`, so no
teammate sign-off gates this work. (Attribution in any write-up is a separate matter
and still applies — the camera loop's design decisions are Siya Yuan's and Jeniffer
Leong's regardless of which branch the code sits on.)
