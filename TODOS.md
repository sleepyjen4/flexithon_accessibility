# TODOS

## Deferred from the alfa-v2 UI/UX pass (2026-08-20)

### Brand-hover design tokens — the whole 34, not 17
`app/globals.css` defines the warm-paper palette, but four brand states are typed as
raw hex at their call sites instead of existing as tokens:

- `#8f2a47` raspberry pressed (5 sites)
- `#3a332b` ink pressed (6 sites)
- `#173f33` evergreen pressed (1 site)
- `#4f4a78` lavender ink (3 sites)

Deferred rather than half-done. There are **60 hex values in `app/` + `components/`;
26 live legitimately in `globals.css`, leaving 34 outside it.** The 17 above are the
easy half. The other 17 are in canvas and SVG code that cannot use Tailwind classes
and re-types token values by hand:

- `components/RangeArc.tsx` — 10, including `#4a4438` and `#7ec8a8` (`:83,105,113`)
  which have **no corresponding token at all**
- `components/PoseTracker.tsx` — 7 (`:136` `#e5a83c` = marigold, `:202` `#e8798f` =
  raspberry-bright / `#8a7d66` = line-strong)
- `components/CalibrationFlow.tsx` — 2

Doing this properly means deciding how canvas code reads design tokens (pass as props,
or read via `getComputedStyle` on a token-bearing element), and naming the two colours
that don't have tokens. That is a real design-system task, not a find-and-replace.

Shipping 17 of 34 and calling it a token pass would leave a shadow palette in exactly
the part of the app most likely to drift.

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
