# AGENTS.md — Adaptive Fitness App (48-Hour Hackathon)

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
3. **AI generates an adapted workout** → filtered by profile, scaled by today's energy
4. **Accessible workout player** → step-by-step, multi-modal instructions, pause-friendly
5. **Progress view** → celebrates showing up and effort, never counts calories or steps

### 1.5 Feature list & priority

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| F1 | Ability-profile onboarding (positions, equipment, mobility ranges, sensory prefs) | P0 | 4–6 screens max, big tap targets, skippable |
| F2 | Exercise library (~30 seeded exercises, JSON) tagged by position/equipment/body-region/intensity | P0 | Seed data hand-written; every exercise has a seated or lying variant |
| F3 | Daily energy check-in (1–5 scale, optional pain/mood note) | P0 | One screen, one tap, done |
| F4 | AI workout generator (LLM call: profile + energy + library → structured workout JSON) | P0 | Falls back to rule-based filter if API fails |
| F5 | Workout player: one exercise per screen, text + illustration + optional TTS audio, timers with pause/extend, "skip — no penalty" button | P0 | The hero screen. Fully keyboard & screen-reader operable |
| F6 | Progress view: consistency calendar + effort log, no calorie/step counts | P1 | Simple, warm copy |
| F7 | Accessibility settings: text size, high contrast, reduced motion, haptics toggle | P1 | Persist in Supabase profile |
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
| App | **Next.js 15 (App Router) + TypeScript**, installable as a **PWA** | No app store, runs on judges' phones; server-side code built in |
| Styling | **Tailwind CSS** | Speed; consistent spacing/contrast tokens |
| Components | **Radix UI primitives** (+ lucide-react icons) | Accessible by default: focus, ARIA, keyboard nav |
| Backend | **Supabase** (auth, Postgres, storage) via `@supabase/ssr` | Zero backend code; magic-link auth |
| AI | **Anthropic API** (claude-sonnet) via a **Next.js Route Handler** (`app/api/generate-workout`) | Key stays server-side; no separate edge functions needed |
| Motion tracking | **@mediapipe/tasks-vision** (PoseLandmarker) — client-side only | All video stays on-device (privacy); no backend, no upload |
| State | **Zustand** (client) + Supabase queries | No Redux. Keep it tiny |
| Deploy | **Vercel** | Push-to-deploy from main |
| A11y testing | axe DevTools + manual VoiceOver pass | Run axe before every merge to main |

**Forbidden:** Pages Router (App Router only), experimental Next.js flags, Redux,
CSS-in-JS libs, custom auth, native builds (Expo/React Native), Supabase Edge
Functions (use Route Handlers), any new dependency not listed above without team
agreement.

---

## 3. Project Structure

```
app/
  layout.tsx                 # Root layout: fonts, providers, skip-to-content link
  page.tsx                   # Landing / auth entry
  onboarding/page.tsx
  check-in/page.tsx
  workout/page.tsx           # Workout player
  progress/page.tsx
  settings/page.tsx
  api/
    generate-workout/route.ts  # Server-side LLM call + zod validation + fallback
components/                  # Reusable UI (Button, Card, Timer, EnergyPicker...)
lib/
  supabase/
    client.ts                # Browser client (createBrowserClient)
    server.ts                # Server client (createServerClient, cookies)
  ai.ts                      # Client helper calling /api/generate-workout
  exercises.ts               # Seed exercise data + filter helpers
store/                       # Zustand stores (profile, session)
types.ts                     # ALL shared types live here
supabase/migrations/
```

**Server/client rules:** components are Server Components by default; add
`"use client"` only where there's interactivity (the player, pickers, forms).
Never import `lib/supabase/server.ts` or the Anthropic SDK into a client component.

---

## 4. Data Model (keep to these 4 tables)

```sql
profiles      (id, display_name, abilities jsonb, prefs jsonb, created_at)
exercises     (id, name, description, positions text[], equipment text[],
               body_regions text[], intensity int, instructions jsonb,
               audio_url, image_url)   -- seeded, read-only at runtime
checkins      (id, user_id, energy int, note, created_at)
sessions      (id, user_id, workout jsonb, completed_steps int[],
               effort int, created_at)
```

`abilities` jsonb shape:
```json
{
  "positions": ["seated", "lying"],
  "equipment": ["resistance_band", "none"],
  "avoid_regions": ["lower_back"],
  "sensory": { "captions": true, "reduced_motion": true, "haptics": false }
}
```

---

## 5. AI Workout Generation Contract

Route Handler `POST /api/generate-workout` receives `{ profile, energy, recent_session_ids }`
and must return **only** this JSON (validate with zod server-side before responding):

```json
{
  "title": "Gentle Seated Strength",
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

Rules for the generator prompt:
- Only reference `exercise_id`s that exist in the seeded library (pass the filtered list in).
- Energy 1–2 → ≤10 min, ≤4 steps, generous rest. Energy 4–5 → up to 25 min.
- Never include exercises requiring positions/equipment outside the profile.
- Tone of `adaptation_note`: practical and warm, never medical advice.
- **Fallback:** if the API call fails or returns invalid JSON, `lib/ai.ts` builds a
  workout with a deterministic filter (position ∩ equipment, sort by intensity, take N by energy).

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

Design tokens:
```
Primary: indigo-600 (#4F46E5) on white; text: slate-900; secondary text: slate-600 (min size 16px)
Backgrounds: white / slate-50. Error: red-700. Success: emerald-700.
Base font: 18px. Spacing scale: 4/8/16/24/32. Radius: rounded-2xl on cards, rounded-xl on buttons.
```

---

## 7. Vibecoding Conventions (for AI agents & humans)

- **TypeScript strict.** No `any`. All shared types in `src/types.ts` — check there before inventing a type.
- **One screen = one folder** with an `index.tsx`. Components under ~150 lines; extract when bigger.
- **Never hardcode secrets.** Client-safe vars use the `NEXT_PUBLIC_` prefix (Supabase URL + anon key only). `ANTHROPIC_API_KEY` has no prefix and is read **only** inside `app/api/*` route handlers.
- **No new dependencies** beyond Section 2 without asking the team.
- **Loading/error/empty states are mandatory** on every screen that fetches data.
- **Mobile-first**: build at 390px width; desktop is a bonus.
- **Commits:** `feat|fix|chore(scope): message`. Push small, push often. `main` must always deploy.
- When an AI generates a component, it must self-check against Section 6 before finishing.
- Prefer editing existing files over creating parallel versions (`WorkoutPlayer2.tsx` = never).

---

## 8. 48-Hour Plan (team of 4)

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

1. Open with the problem: show a mainstream app's "10,000 steps!" screen. (20s)
2. Onboard as a wheelchair user with a resistance band. (30s)
3. Check in at energy **2** → generate → show the short, gentle, seated workout. (25s)
4. Re-check-in at energy **4** → show the longer, harder plan. *The adaptive moment.* (25s)
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
offline sync beyond default PWA caching.