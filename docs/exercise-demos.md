# Exercise Demo Clips (GIF → video) — Handover

How the animated exercise demonstrations work: where the assets live, how GIFs
become web video, how an exercise is mapped to its clip, and which files render
it. Follow the **"Add a new demo"** checklist to wire up more exercises.

---

## 1. What it is

Each supported exercise shows a short, muted, looping **movement demo**. Source
art is a square GIF; we transcode it to **MP4 + WebM** (≈10–20× smaller, and —
unlike a GIF — pausable, so we can honour reduced-motion). The demo appears in:

- the **workout/exercise player** (top of the "reading" column), and
- the **library** exercise cards.

Exercises without a clip simply render nothing — the feature is fully additive.

**Status:** 26 exercises are wired (every GIF currently in `public/graphics/`).
The rest have no clip yet.

---

## 2. Assets

```
public/graphics/
  <name>.gif            # source art, 1080×1080 (kept — do not delete)
  <name>.mp4            # generated, H.264, ~720², ~24–64 KB
  <name>.webm           # generated, VP9,   ~720², ~24–64 KB
```

- `<name>` should be a clean slug (`lowercase_snake_case`, no spaces/caps).
  Normalise first if a source file has spaces
  (e.g. `Isometric glute contraction.gif` → `isometric_glute_contraction.gif`).
- The `.mp4`/`.webm` are build artifacts committed to the repo. The `.gif`
  originals are kept.

---

## 3. Conversion pipeline

**Script:** [`scripts/generate-exercise-video.mjs`](../scripts/generate-exercise-video.mjs)

```bash
# ffmpeg is NOT a project dependency — install the static binary transiently
# (adds nothing to package.json), or use a system ffmpeg.
npm install --no-save ffmpeg-static

node scripts/generate-exercise-video.mjs                    # convert all *.gif
node scripts/generate-exercise-video.mjs seated_bicep_curl  # convert specific
FORCE=1 node scripts/generate-exercise-video.mjs <name>     # re-encode existing
```

- **Idempotent:** skips any clip that already has both `.mp4` and `.webm`
  (unless `FORCE=1`).
- **MP4:** H.264, `crf 28`, `yuv420p`, `+faststart`, scaled to 720px wide.
- **WebM:** VP9, `crf 34`; speed flags (`-deadline good -cpu-used 5 -row-mt 1`)
  because VP9's default is very slow.
- Audio is stripped; playback is muted.
- Mirrors the build-time audio pipeline (AGENTS §5c) — a build/asset step, never
  a runtime dependency.

> Encoding all clips can take a few minutes (VP9 is the bottleneck). Convert only
> what's new by passing names.

---

## 4. Exercise → clip mapping

**File:** [`lib/exerciseVideos.ts`](../lib/exerciseVideos.ts)

The mapping lives here, **not** on the `Exercise` record — it isn't a DB column
(AGENTS §4). Keys are **exercise ids** (must exist in `lib/exercises.ts`); values
are the **base path with no extension** (the component appends `.webm`/`.mp4`).

```ts
export const EXERCISE_VIDEO_BY_ID: Record<string, string> = {
  seated_lateral_raise: "/graphics/seated_lateral_raise",
  // …
  // Aliases: source filename differs from the id it illustrates.
  seated_band_row:      "/graphics/seated_resistance_band_row",
  seated_torso_twist:   "/graphics/chair_pilates",
  wall_pushup:          "/graphics/wall_or_incline",
  lying_knee_to_chest:  "/graphics/lying_knee_stretch",
};

export function getExerciseVideoUrl(exerciseId: string): string | null {
  return EXERCISE_VIDEO_BY_ID[exerciseId] ?? null;
}
```

If a clip's filename matches its exercise id, the entry is trivial
(`id: "/graphics/id"`). If not, **alias** it (key = exercise id, value = actual
file base path).

---

## 5. The component

**File:** [`components/ExerciseDemo.tsx`](../components/ExerciseDemo.tsx)

```tsx
<ExerciseDemo videoUrl={basePath} name={exercise.name} interactive={false?} />
```

- Renders `<video muted loop playsInline>` with `<source>` webm → mp4.
- `object-contain` inside a capped, responsive frame
  (`max-h` 180 → 220 → 260px) so it never pushes the timer/Done controls
  off-screen.
- **Reduced motion** (in-app `prefs.reduced_motion` **or** OS
  `prefers-reduced-motion`): does not autoplay — stays paused with a play button
  (AGENTS §6 r6).
- `interactive={false}` **omits the play button** — required when the demo sits
  inside a link (library card) to avoid nested interactive elements.

---

## 6. Where it renders (pages to edit)

| Surface | File | How |
|---|---|---|
| Player (`/workout`, `/exercise/[id]`) | [`components/ExerciseStep.tsx`](../components/ExerciseStep.tsx) | `const demoUrl = getExerciseVideoUrl(exercise.id)` → renders `<ExerciseDemo>` atop the left column |
| Library cards (`/library/[group]/[value]`) | [`app/library/[group]/[value]/page.tsx`](../app/library/%5Bgroup%5D/%5Bvalue%5D/page.tsx) | per card: `getExerciseVideoUrl(exercise.id)` → `<ExerciseDemo interactive={false}>` |

Both call `getExerciseVideoUrl(exercise.id)` and render only when it's non-null.
**To surface demos on a new page, do the same:** import `getExerciseVideoUrl`
and `ExerciseDemo`, and render when the id resolves.

---

## 7. Add a new demo — checklist

1. **Drop the GIF** at `public/graphics/<exercise_id>.gif` (name it exactly the
   exercise id; slugify if needed).
2. **Convert:** `node scripts/generate-exercise-video.mjs <exercise_id>`
   (run `npm install --no-save ffmpeg-static` first if ffmpeg is missing).
3. **Map it** in `lib/exerciseVideos.ts`:
   `"<exercise_id>": "/graphics/<file_base>"` (alias if filename ≠ id).
4. Done — it appears in the player and library automatically.

---

## 8. Verify

```bash
npx tsc --noEmit -p tsconfig.json          # types
npx next build                             # builds every exercise + library page
```

Integrity spot-checks:

- Every key in `EXERCISE_VIDEO_BY_ID` is a real id in `lib/exercises.ts`.
- Every mapped base path has both `.mp4` and `.webm` in `public/graphics/`.
- Assets serve (`GET /graphics/<name>.mp4` → 200), and a library page's SSR
  contains the `<video>` sources.

---

## 9. Gotchas & notes

- **Filenames:** no spaces/capitals — normalise to a slug before converting.
- **Keys are ids, values are files.** A wrong id = no demo (silent); a wrong
  path = broken `<source>` (browser falls back mp4 ↔ webm, else nothing shows).
- **`ffmpeg-static` is transient** (`--no-save`) — it is not in `package.json`;
  reinstall it on a fresh checkout before converting.
- **Reduced motion** is handled centrally in `ExerciseDemo` — don't add
  autoplay elsewhere.
- **Library autoplay volume:** a position page can autoplay ~20+ small clips at
  once (~1 MB total). Fine today; if it grows, switch cards to play-on-hover or
  an IntersectionObserver.
- **Poster frames (future):** reduced-motion cards currently show a blank first
  frame until played. Generating static poster images would give them a real
  thumbnail.
