# AGENTS.md — Alpha App (48-Hour Hackathon)

> **Read this entire file before generating any code.** It is the single source of truth
> for scope, stack, conventions, and accessibility rules. When in doubt, choose the
> simpler option that ships.

---

## 1. Product Requirements (PRD)

### 1.1 One-liner
A fitness app that adapts to *your* body and *your* energy today — built for disabled
users first, not retrofitted.

### 1.2 Problem
Mainstream fitness apps assume a standing, two-handed, sighted, high-energy user.
Disabled users face two failures:
1. **Exercise content** has no seated / lying / one-limb / low-vision variants.
2. **Progress metrics** (steps, calories, streaks) punish fluctuating conditions
   like chronic fatigue, MS, or pain flares.

### 1.3 Target users (for demo narrative)
- Wheelchair users / limited lower-body mobility
- Chronic illness & fatigue (ME/CFS, MS, POTS) — variable daily capacity
- Limb difference / limited upper-body mobility
- Blind / low-vision users (app must be fully screen-reader operable)
- Deaf / hard-of-hearing users (all audio content captioned)

### 1.4 Core loop (the demo path — protect this at all costs)
1. **Onboard** → build an *ability profile* (positions, equipment, limits) — never asks for diagnoses
2. **Daily energy check-in** → 1–5 "battery" scale (spoon-theory inspired)
3. **A workout is built for today** → filtered by profile, scaled by today's energy, on-device
4. **Accessible workout player** → step-by-step, multi-modal instructions, pause-friendly
5. **Progress view** → celebrates showing up and effort, never counts calories or steps

### 1.5 Feature list & priority

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| F1 | Ability-profile onboarding (positions, equipment, mobility ranges, sensory prefs) | P0 | 4–6 screens max, big tap targets, skippable |
| F2 | Exercise library (37 seeded exercises, JSON) tagged by position/equipment/body-region/intensity | P0 | Seed data hand-written. Every exercise that is meant to be demonstrated has a demo clip; only `manual_entry` activities are exempt (enforced by `lib/exercises.test.ts`) |
| F3 | Daily energy check-in (1–5 scale, optional pain/mood note) | P0 | One screen, one tap, done |
| F4 | Workout builder (`lib/workoutBuilder.ts`): profile + energy + library → workout | P0 | Deterministic, pure, on-device. **No model is called at runtime** — see § 5 |
| F5 | Workout player: one exercise per screen, text + illustration + optional TTS audio, timers with pause/extend, "skip — no penalty" button | P0 | The hero screen. Fully keyboard & screen-reader operable |
| F6 | Progress view: consistency calendar + effort log, no calorie/step counts | P1 | Simple, warm copy |
| F7 | Accessibility settings: text size, high contrast, reduced motion, haptics toggle | P1 | Persist in `store/profile.ts` (localStorage) |
| F8 | Voice control of the workout player ("next", "pause") | P2 | Web Speech API, demo-only if time permits |
| F9 | **Motion tracking (MediaPipe Pose, client-side):** hands-free rep counting + range-of-motion capture for ONE seated upper-body hero exercise | P1 | Upper-body landmarks only; app fully usable with camera off; no form correction ever |
| F10 | Buddy/community feed | ❌ CUT | Do not build |
| F11 | Wearable / HealthKit integration | ❌ CUT | Do not build |
| F12 | Form correction / "you're doing it wrong" feedback | ❌ CUT | Unvalidatable in 48h; medical-advice risk. Do not build, do not pitch |

### 1.6 Success criteria for judging
- Full demo path (F1→F5) works end-to-end on a phone browser
- Entire flow completable with VoiceOver/TalkBack — rehearse this live
- Zero WCAG 2.1 AA contrast failures on demo screens
- One "wow": energy check-in visibly changes the generated workout (show energy=2 vs energy=5)

---

## 2. Tech Stack (locked — do not substitute)

| Layer | Choice | Why |
|-------|--------|-----|
| App | **Next.js 15 (App Router) + TypeScript**, with a web app manifest | No app store, runs on any phone browser. **Not yet a true installable PWA** — there is no service worker, so there is no offline support and Android will not offer an install prompt |
| Styling | **Tailwind CSS** | Speed; consistent spacing/contrast tokens |
| Components | **Radix UI primitives** (+ lucide-react icons) | Accessible by default: focus, ARIA, keyboard nav |
| Backend | **None.** The app runs entirely on-device | Accounts were removed in `f6ad796`. No auth, no server data, nothing to sync. See § 4 |
| AI | **None at runtime.** `@google/genai` is a **devDependency** used only by `scripts/generate-audio.ts` at build time | The runtime Gemini path was removed in `0968b4a`: measured 8.8-13.6s against a 4000ms client timeout, so it aborted on every call and had never once reached a user |
| Voice (TTS) | **Google AI Studio (Gemini API)** (pre-generated at build time → `audio_url`) + **Web Speech API** runtime fallback | Warm, consistent female voice across devices; clips are static files, so no runtime dependency, cost, or privacy leak |
| Motion tracking | **@mediapipe/tasks-vision** (PoseLandmarker) — client-side only | All video stays on-device (privacy); no backend, no upload |
| State | **Zustand** with `persist` → localStorage (`store/`) | No Redux. Keep it tiny |
| Deploy | **Vercel** | Push-to-deploy from main |
| A11y testing | axe DevTools + manual VoiceOver pass | Run axe before every merge to main |

**Forbidden:** Pages Router (App Router only), experimental Next.js flags, Redux,
CSS-in-JS libs, custom auth, native builds (Expo/React Native), any runtime LLM
call, any new dependency not listed above without team agreement.

Note: there is no test environment with a DOM. `vitest.config.ts` is
`environment: "node"`, and neither jsdom nor happy-dom is installed, so
component-render and hydration behaviour cannot currently be unit-tested. Adding
one is a new devDependency and therefore a team decision.

---

## 3. Project Structure

```
app/
  layout.tsx                 # Root layout: fonts, providers, skip-to-content link
  page.tsx                   # Landing (marketing; its own nav — see lib/chromeRoutes)
  onboarding/page.tsx        # F1 ability profile
  dashboard/page.tsx         # The hub: energy check-in (F3) + build today's workout
  workout/page.tsx           # F5 player, via DailyWorkoutLoader
  exercise/page.tsx          # F9 camera-tracked set (calibrate -> track -> summary)
  exercise/[exerciseId]/     # Single exercise from the library, played in F5
  library/page.tsx           # Browse the seeded library
  library/[group]/[value]/   # Library filtered by position/equipment/region/category
  calibrate/page.tsx         # F9 personal range capture
  summary/page.tsx           # F9 set summary; writes the set into history
  progress/page.tsx          # F6
  settings/page.tsx          # F7
components/                  # Reusable UI (Button, Card, Timer, ExerciseVisual...)
lib/
  workoutBuilder.ts          # F4 — the workout generator (deterministic, pure)
  exercises.ts               # Seed exercise data + filter helpers
  exerciseVideos.ts          # exercise id -> demo clip base path
  audioManifest.ts           # GENERATED by scripts/generate-audio.ts
  speech.ts                  # Pre-generated clip, else Web Speech (§ 5c)
  pose/                      # F9: angles, smoothing, rep counting, providers
store/                       # Zustand stores, all persisted to localStorage
types.ts                     # ALL shared types live here
assets/exercise-gifs/        # 1080² GIF masters. NOT served — build input only
public/graphics/             # Generated 720² .webm/.mp4 demo clips (served)
public/audio/                # Pre-generated instruction audio (served)
scripts/                     # Build-time only: audio, video, screenshots
supabase/migrations/         # Design artifact, not wired to anything (§ 4)
```

There is **no `src/` directory** and **no `app/api/`**. Nothing runs on a server
beyond Next.js rendering the pages.

**Server/client rules:** components are Server Components by default; add
`"use client"` only where there's interactivity (the player, pickers, forms).
Never import the Gemini SDK into any app code — it is a build-script dependency
and must not enter the bundle.

---

## 4. Data Model (all on-device)

There is no server. Everything persists to `localStorage` through Zustand's
`persist` middleware, one store per concern:

| Store | Key | Holds |
|---|---|---|
| `store/profile.ts` | `af-profile` | `displayName`, `abilities`, `prefs` (F7), `todaysEnergy` |
| `store/history.ts` | `af-history` | `sessions[]` (F6 effort log), `checkins[]` (F3) |
| `store/calibration.ts` | `af-calibration` | Per-exercise `PersonalRange` (F9) |
| `store/session.ts` | `af-session` | In-flight workout. **Only `trackingSummary` is persisted** — see below |

`abilities` shape:
```json
{
  "positions": ["seated", "lying"],
  "equipment": ["resistance_band", "none"],
  "avoid_regions": ["lower_back"],
  "sensory": { "captions": true, "reduced_motion": true, "haptics": false }
}
```

**Why the in-flight workout is not persisted.** Restoring a half-finished
session days later would drop the user mid-workout with no context. Because F4
is deterministic, `/workout` rebuilds today's workout from the persisted
`abilities` + `todaysEnergy` instead (`components/DailyWorkoutLoader.tsx`) and
restarts at step one. Progress within a workout is deliberately not restored.

**Durability caveat, unsolved.** `localStorage` is evictable — iOS Safari clears
it after roughly seven days without a visit. For an app whose users have
fluctuating energy, the gap that triggers eviction is exactly the gap the app
exists to accommodate. `navigator.storage.persist()` and a user-facing
export/import are the fixes that fit the on-device model; neither is built.

`supabase/migrations/0001_init.sql` is kept deliberately as a design artifact —
the schema and RLS policies for an accounts version. It is not wired to
anything at runtime and there is no Supabase client in the app.

---

## 5. Workout Generation Contract (F4)

`lib/workoutBuilder.ts` is the only workout generator. It is pure, synchronous
and deterministic: the same `(abilities, energy)` always produce the same
workout, which is what lets `/workout` rebuild after a refresh instead of
persisting one (§ 4).

```ts
buildWorkout({ abilities, energy }): WorkoutBuildResult

type WorkoutBuildResult =
  | { ok: true; workout: Workout }
  | { ok: false; reason: "no_exercises_available" };
```

`Workout` (see `types.ts`):
```json
{
  "title": "Gentle Reset",
  "estimated_minutes": 15,
  "energy_level": 2,
  "steps": [
    {
      "exercise_id": "seated_band_row",
      "duration_seconds": 45,
      "reps": null,
      "rest_after_seconds": 60,
      "adaptation_note": "Keep elbows low; stop if shoulder pain."
    }
  ]
}
```

Rules:
- Only `exercise_id`s from the seeded library; position ∩ equipment, minus
  `avoid_regions`.
- Energy 1–2 → 4 steps, 30s work / 60s rest. Energy 3 → 5 steps. Energy 4–5 → 6
  steps, 45s work / 30s rest.
- `HERO_EXERCISE_ID` is included whenever the profile allows it, so the camera
  step (F9) has somewhere to attach.
- **The empty case is in the return type.** A profile can filter the library to
  zero (avoid every body region). Callers must check `ok` before reaching
  `.workout`; returning a stepless workout made the player read `0 >= 0` as
  "finished" and congratulate the user on a workout that never existed.

**Known gap:** `adaptation_note` is currently the same sentence on every step.
Per-exercise notes belong in the `lib/exercises.ts` seed, and titles should
cover all five energy levels rather than two. Not yet done.

**Do not reintroduce a runtime model call.** It was tried and removed (`0968b4a`):
Gemini measured 8.8–13.6s against a 4000ms client timeout, so every request
aborted and silently served this builder. Nothing errored, which is why it went
unnoticed for six weeks. If you want richer notes, write them into the seed.

---

## 5b. Motion Tracking Rules (MediaPipe Pose — F9)

**Architecture:** lives entirely in a `"use client"` component (`components/PoseTracker.tsx`),
loaded with `next/dynamic` and `ssr: false`. Model files served from the official MediaPipe
CDN (or bundled in `public/` if venue Wi-Fi is flaky). Video frames are processed
in-browser and **never uploaded or stored** — say this in the pitch.

**Scope (hard limits):**
- ONE hero exercise for the demo (seated lateral raise). Others only if trivial.
- Upper-body landmarks only (shoulders, elbows, wrists; hips as anchor). Ignore lower body
  entirely — the model is unreliable for seated users and people with limb differences.
- Two outputs only: **rep count** and **peak range-of-motion angle** per set.
- **Never** output form judgments, corrections, or "wrong movement" messaging.

**Implementation notes:**
- Compute the joint angle from 3 landmarks per frame; smooth with an exponential moving
  average (α ≈ 0.3); count a rep on threshold crossings **with hysteresis** (e.g., up past
  80°, down past 30°) to avoid jitter double-counts.
- Only count when landmark visibility scores are high; if landmarks drop out, pause
  counting silently — never show an error implying the user's body or setup is the problem.
- Persist `peak_rom_degrees` per exercise into `sessions.workout` jsonb so F6 can chart
  range-of-motion over time.

**Graceful degradation (non-negotiable):** the workout player must be 100% functional with
the camera off or permission denied. Camera is an enhancement layered on top of manual
"done" buttons, never a requirement. Announce rep counts via `aria-live="polite"` so
blind users benefit from hands-free counting too.

**Demo safety:** rehearse the camera segment in the actual venue lighting; record a backup
screen capture. If tracking misbehaves live, tap "done" manually and move on — the app
must make that look intentional.

---

## 5c. Pre-generated Voice Audio (Google AI Studio — F5 TTS)

The workout player speaks exercise instructions. OS Web Speech voices vary wildly
across devices, so for a warm, consistent female voice, instruction audio is
**pre-generated at build time with Google AI Studio (Gemini API)** and served as static files — never
called live.

- **Pipeline:** `scripts/generate-audio.ts` reads the seeded library
  (`lib/exercises.ts`), synthesizes one audio file per exercise (name + instructions), writes
  them to `public/audio/<exercise_id>.*` (WAV for Gemini, MP3 for Cloud TTS), and regenerates the `lib/audioManifest.ts`
  id→url map. Run with `npm run generate:audio`.
- **Providers:** Gemini / Google AI Studio first (`GEMINI_API_KEY` — build-time only; there is no app key), **Google Cloud TTS as an
  automatic fallback** (`GOOGLE_TTS_API_KEY`) if Gemini is unset or fails. The script probes on the first exercise and
  locks in one provider for the whole run, so voices never mix; force one with
  `TTS_PROVIDER=gemini|google`.
- **Runtime:** the player prefers the pre-generated clip (`exercise.audio_url` ??
  manifest) and **falls back to the Web Speech API** (`lib/speech.ts`, `speakOrPlay`)
  whenever a clip is missing, and for dynamic strings (rep counts, the rest cue). With no
  clips generated yet, everything falls back — so the app always works.
- **Privacy:** clips are static assets, so nothing is uploaded at runtime. The
  Gemini/Google keys are used only by the build script, never shipped to the client.
  They are **not** available offline — there is no service worker (§ 2).
- **Scope:** clips cover only the static name + instructions. The AI-generated
  `adaptation_note` stays on screen and is spoken only via Web Speech on the fallback
  path — never try to pre-generate dynamic text.

---

## 6. Accessibility Rules (non-negotiable — apply to every component)

1. **Touch targets ≥ 48×48px.** Primary action buttons are full-width on mobile.
2. **Contrast:** text ≥ 4.5:1, large text ≥ 3:1. Use the Tailwind tokens below only.
3. **Semantic HTML first:** real `<button>`, `<nav>`, `<main>`, `<h1>`–`<h3>` hierarchy per screen. ARIA only when semantics can't do it.
4. **Every interactive element** works with keyboard alone; visible focus ring (never `outline: none` without a replacement).
5. **Timers announce state changes** via `aria-live="polite"`; never rely on color alone.
6. **Respect `prefers-reduced-motion`** — gate every animation behind it.
7. **All images:** meaningful `alt`; decorative images `alt=""`.
8. **No autoplaying audio.** TTS is user-triggered.
9. **Copy tone:** never "just", "simply", "easy". Never guilt-trip ("you missed a day"). Skipping is always framed as a valid choice.
10. **Forms:** every input has a visible `<label>`; errors announced and described in text.

Design tokens — **"warm paper"**, defined in `app/globals.css` and exposed as
Tailwind classes. Use the token classes; **never** raw `slate-*`, `indigo-*`,
`emerald-*` or a literal hex at a call site.

```
Ground      bg-cream (#f6eddc) page · bg-surface (#fffdf7) cards · bg-stage (#26211c) camera
Text        text-ink (#211d19) · text-ink-soft (#5c5347) secondary · text-milk (#fff9ee) on dark
Accents     raspberry (#a93254) hero · evergreen (#1f5747) success · marigold / lavender / mint washes
Lines       border-line hairlines · border-line-strong interactive (3:1)
Error       text-error (#b3261e)
Type        font-display = Bricolage Grotesque (headings) · font-sans = Figtree (body)
Base font   18px root. Spacing 4/8/16/24/32. Radius: rounded-3xl cards, rounded-full buttons.
```

Every pairing is contrast-verified and the ratios are documented at the top of
`app/globals.css` — ink on cream 15.3, ink-soft on cream 6.9, raspberry on cream
5.9, milk on ink 16.0. Adding a colour means adding a token there, with its
ratio, not typing a hex into a component.

**Hover idiom — pick by what is *behind* the element, not by what it is.**
Every wash in the palette is within 1.15:1 luminance of cream, so a light-on-light
hover can produce an edge with no luminance change at all. See the equiluminance
note at the top of `app/globals.css` before inventing a new hover.

- Control **inside a card** (`bg-surface`): `hover:bg-mint`. Surface → mint is
  1.20:1 — a real step. This is the default idiom.
- Control **directly on the page** (`bg-cream`): no wash works. Use border
  (`line` → `line-strong`) plus elevation. Never `hover:bg-cream` here — it
  paints the element to exactly the page colour and it dissolves. That shipped
  once.
- **Dark surfaces:** `bg-milk/10` scrims. Never `bg-white`.

High contrast (`html[data-contrast="high"]`) darkens the accents *and* their
`-deep` hover shades together, so hover feedback survives the mode.

Canvas and SVG read tokens at runtime via `lib/canvasPalette.ts`, which
resolves the custom properties once from the document root and drops its cache
when `data-contrast` changes — so the camera stage follows high contrast like
everything else. Never call `getComputedStyle` from inside a draw loop.

Remaining token debt: two colours in `RangeArc` (`#4a4438` arc track, `#7ec8a8`
target-met marker) still have no token at all. See `TODOS.md`.

---

## 7. Vibecoding Conventions (for AI agents & humans)

- **TypeScript strict.** No `any`. All shared types in `types.ts` at the repo root (there is no `src/`) — check there before inventing a type.
- **One screen = one folder** with an `index.tsx`. Components under ~150 lines; extract when bigger.
- **Never hardcode secrets.** The app needs **no** environment variables to run — nothing calls a keyed service at runtime. `GEMINI_API_KEY` and `GOOGLE_TTS_API_KEY` are read **only** by `scripts/generate-audio.ts` at build time, and must never be read from `app/`, `components/`, `lib/` or `store/`.
- **No new dependencies** beyond Section 2 without asking the team.
- **Loading/error/empty states are mandatory** on every screen that fetches data.
- **Mobile-first**: build at 390px width; desktop is a bonus.
- **Commits:** `feat|fix|chore(scope): message`. Push small, push often. `main` must always deploy.
- When an AI generates a component, it must self-check against Section 6 before finishing.
- Prefer editing existing files over creating parallel versions (`WorkoutPlayer2.tsx` = never).

---

## 8. 48-Hour Plan (team of 4) — HISTORICAL

> This is the original hackathon schedule, kept as a record of who built what.
> It is **not** a description of the current system: the Supabase and
> `/api/generate-workout` work in column C was built and has since been removed.
> Do not treat this table as instructions.

| Block | A (Frontend/UI) | B (Frontend/Player) | C (Backend/AI) | D (Design/Content/QA) |
|-------|-----------------|--------------------|----------------|----------------------|
| H0–4 | Repo, `create-next-app` + Tailwind + Radix, design tokens, root layout & routes | Component library: Button, Card, Timer, EnergyPicker | Supabase project, schema, `@supabase/ssr` auth, seed script | Write 30 exercises w/ variants + adaptation notes; find/draw illustrations |
| H4–12 | Onboarding flow (F1) | Workout player skeleton (F5) | `/api/generate-workout` route handler + LLM prompt + zod validation + fallback (F4) | Copywriting; a11y review of components |
| H12–24 | Check-in (F3) + Settings (F7) | Player polish: TTS, pause/extend, skip | Wire generator to real profile+energy; sessions writeback | axe + VoiceOver pass #1; file bugs |
| H24–36 | Progress view (F6) incl. ROM chart | **Motion tracking (F9): PoseTracker on the hero exercise** *only if all P0 done* | Hardening, rate limits, error states | Demo script; seed demo account; camera rehearsal |
| H36–44 | **Bug fixes only — feature freeze at H36** | ← | ← | Full VoiceOver rehearsal of demo path |
| H44–48 | Deploy freeze, demo run-throughs ×3, slides | ← | ← | Backup video recording of demo |

**Rule: if a P0 is at risk, everyone drops P1/P2 work immediately.**

---

## 9. Demo Script (3 minutes)

> Written for the original demo and still the best walkthrough of the product.
> The check-in now lives on `/dashboard` rather than its own screen, and the
> workout is built on-device rather than generated by a model.

1. Open with the problem: show a mainstream app's "10,000 steps!" screen. (20s)
2. Onboard as a wheelchair user with a resistance band. (30s)
3. On `/dashboard`, check in at energy **2** → build → the short, gentle, seated
   workout (4 steps, 30s work, 60s rest). (25s)
4. Re-check in at energy **4** → the longer, harder plan (6 steps, 45s / 30s).
   *The adaptive moment.* (25s)
5. Hero exercise with camera on: hands-free rep counting, live ROM angle — mention all
   processing is on-device, nothing uploaded. (40s)
6. Run one step **with VoiceOver on, screen visible** — rep counts announced aloud. (30s)
7. Progress screen: consistency + "your shoulder range improved 12° this week" — no
   calories anywhere. Close on mission. (20s)

---

## 10. Out of Scope — Do Not Build, Do Not Suggest

Social features, wearables, video *recording/storage* (live on-device tracking only),
form correction or movement judgments, diet/nutrition, medical advice or diagnosis
language, notifications, payment/subscription, admin dashboards, i18n, native apps,
accounts or any server-side data, and any runtime LLM call.

---

## 11. Known Gaps (real, verified, unfixed)

Recorded so they are not rediscovered as surprises. See `TODOS.md` for detail.

- **No service worker.** No offline support; Android will not offer an install
  prompt. `manifest.webmanifest` also has `start_url: "/"`, so an installed app
  opens on the marketing page rather than `/dashboard`, and ships one 512px icon
  with no 192px and no `maskable`.
- **`localStorage` is evictable** (§ 4). No `navigator.storage.persist()` call,
  no export/import.
- **`adaptation_note` is one repeated sentence** across every step (§ 5).
- **Token debt in canvas/SVG code** (§ 6).
- **No DOM test environment** (§ 2), so hydration bugs cannot be unit-tested.
  One such bug — the energy dial pinned to 3 — was found only in a browser.
- **Sub-16px text**, partly fixed. `--text-sm` is now overridden in
  `app/globals.css` to 0.889rem = 16.00px at the 18px root, clearing all 10
  `text-sm` call sites. `text-xs` is still 13.5px across 26 sites; 23 of those
  are uppercase, wide-tracked eyebrow labels where the size is intentional, but
  three carry real prose (`DashboardNav` mobile labels, `ProgressView`'s mint
  chip, `VoiceControl`'s hint line) and should move to `text-sm` individually.
  Note that under the 16px "Compact" root everything below `base` is under 16px
  by construction — no relative scale can prevent that. The onboarding name
  placeholder also computes to 3.54:1 against a 4.5:1 bar.
- **Two dashboard loops.** `/dashboard` still presents the built workout and the
  camera session as coequal, and `/workout` has one inbound edge.