# TICKETS.md — Weekend Sprint Board (Demo: Monday 1pm)

**Owners:** A = pose pipeline · B = exercise screen/tracker · C = calibration/summary/voice · D = design/copy/a11y/pitch

**How to work async:**
- Everything integrates through the contracts in Section 0. Never change a contract
  unilaterally — post in the team chat, get one 👍, update `types.ts`, then build.
- B and C build against the **mock pose provider (T03)** until A's real lib lands. Swap
  is one import change.
- Complexity: **S** ≤1.5h · **M** ≤3h · **L** ≤4h. If a ticket blows 1.5× its estimate,
  say so in chat immediately — someone descopes or swarms.
- 🔴 = critical path. If a 🔴 ticket slips, it preempts everyone's P1/P2 work.
- Definition of Done for every ticket: merged to `main`, `main` builds and deploys on
  Vercel, acceptance criteria demonstrably true, no `any` types.

---

## 0. CONTRACTS (agreed at kickoff, live in `types.ts` — the async backbone)

```ts
export interface PoseFrame {            // what the tracker emits every frame
  angleDeg: number;                     // smoothed joint angle for active exercise
  visibility: number;                   // 0–1 min visibility of required landmarks
  timestamp: number;
}

export interface PersonalRange { minDeg: number; maxDeg: number; }

export type RepEvent =
  | { type: "rep"; count: number }
  | { type: "range_reached" }           // hit 85% of personal max
  | { type: "tracking_paused" }         // low visibility — pause silently
  | { type: "tracking_resumed" };

export interface ExerciseDef {
  id: "seated_arm_raise" | "seated_torso_twist";
  name: string;
  landmarks: [number, number, number];  // MediaPipe indices for angle triple
  side: "left" | "right" | "either";    // single-limb support
  instructions: string[];               // spoken + displayed, step by step
  cues: { rangeReached: string; encourage: string[] };
}

export interface SessionSummary {
  exerciseId: string; reps: number;
  personalRange: PersonalRange; peakAngleToday: number;
  startedAt: number; endedAt: number;
}

// Both the MOCK (T03) and REAL (T05/T06) implement this:
export interface PoseProvider {
  start(video: HTMLVideoElement, ex: ExerciseDef): void;
  stop(): void;
  onFrame(cb: (f: PoseFrame) => void): void;
  onRepEvent(cb: (e: RepEvent) => void): void;  // only after calibrate() is set
  setRange(r: PersonalRange): void;
}
```

---

## SATURDAY AM — foundations & the spike

### T00 · ALL · Kickoff (30 min, the only synchronous meeting)
Lock scope = AGENTS.md. Ratify Section 0 contracts. Confirm owner split. Create the
shared "BLOCKED / decisions" chat thread.
**AC:** `types.ts` committed; everyone knows their Sat tickets.

### 🔴 T01 · A · MediaPipe spike — landmarks on webcam · **M (3h)**
Bare `"use client"` page (`app/spike/page.tsx`): `getUserMedia` → `PoseLandmarker`
(`@mediapipe/tasks-vision`, `next/dynamic`, `ssr:false`) → draw raw landmarks on a canvas.
No styling, no abstraction — prove the pipeline on BOTH a laptop webcam and one phone.
**AC:** ≥15fps on laptop; landmarks visibly track a seated person's arms; screenshot
posted in chat. **This ticket is the project's risk. Nothing else A does matters until
it's green. If it's red by lunch → team call, consider MoveNet fallback (team decision,
not solo).**

### T02 · B · Repo scaffold + deploy · **M (2h)**
`create-next-app` (App Router, TS, Tailwind, no src dir) + Radix + lucide + Zustand +
design tokens from AGENTS.md §7 + empty routes (`/`, `/calibrate`, `/exercise`,
`/summary`) + Vercel wired to `main`.
**AC:** live Vercel URL in chat; all routes render placeholder headings; fonts/tokens applied.

### T03 · C · Mock pose provider + session store · **S (1.5h)**
`lib/pose/mockProvider.ts` implementing `PoseProvider`: emits a sinusoidal `angleDeg`
(20°→150°, ~3s period, slight noise) and synthesizes `RepEvent`s from `setRange`.
Plus `store/session.ts` (Zustand): calibration, live reps, summary.
**AC:** B and C can build every screen with zero MediaPipe code; demo page logs mock reps.
**⚠️ Unblocks B & C for the whole day — do this before anything else.**

### T04 · D · Wireframes + full copy deck · **M (3h)**
Figma (or paper): 3 screens max. Copy doc: instructions and cues for BOTH exercises,
encouragement lines (baseline-relative, no "just/simply", no failure framing), camera
permission ask, camera-denied fallback text, reframing guidance ("move back a little so
I can see your arms").
**AC:** copy doc reviewed by C (who wires voice); wireframes posted; B/C confirm buildable.

---

## SATURDAY PM — pose math & first screens (fully parallel)

### 🔴 T05 · A · `angles.ts` + `smoothing.ts` + unit tests · **M (2h)**
Joint angle via `atan2` over a 3-landmark triple; EMA filter (α = 0.3 exported constant,
comment: tremor users may need ≈0.15). Pure functions, Vitest tests with known triangles.
**AC:** tests pass in CI/locally; A posts angle read-outs from live webcam using T01 page.

### 🔴 T06 · A · `repCounter.ts` hysteresis state machine + tests · **M (2.5h)**
States: `idle → rising → peaked → falling → rep++`. Rep = angle crosses `0.85 × maxDeg`
up, then below `minDeg + 0.15 × range` down. Gate on `visibility ≥ 0.6` → emit
`tracking_paused/resumed`. Emit `range_reached` once per rep at the top.
**AC:** unit tests cover: clean reps, jitter around threshold (no double count),
visibility dropout mid-rep (no phantom rep), partial rep (no count). **Hardest logic of
the project — tests are not optional.**

### T07 · B · `PoseTracker.tsx` + skeleton overlay · **M (3h)** · needs T02, T03
Client component: video element + canvas overlay drawing landmarks/skeleton; consumes any
`PoseProvider` (mock for now). Camera permission flow with D's copy; permission-denied
state renders text instructions + manual "done" taps (app never dead-ends).
**AC:** overlay renders with mock provider; denied-state demo works; swap to real
provider is a one-line import.

### T08 · C · Calibration screen + `calibration.ts` · **M (3h)** · needs T03
`/calibrate`: pick exercise → 3 guided movements → record smoothed min/max →
`PersonalRange` (85% comfort margin per AGENTS.md) → store → route to `/exercise`.
"Recalibrate" always one tap away. Works entirely on mock.
**AC:** full flow on mock; range persists in store; keyboard-operable.

### T09 · C · `speech.ts` voice output · **S (1.5h)**
`speak(text, {interrupt})` wrapping `speechSynthesis`: cancel-before-speak for counts
(no pile-ups), queue for instructions. `<Announcer>` component mirrors every utterance
to `aria-live="polite"` text.
**AC:** rapid rep counts don't overlap; every utterance has a visual twin.

### T10 · D · `exercises.ts` hardcoded content + a11y harness · **S (1.5h)** · pairs w/ A on indices
Fill `ExerciseDef[]` for both exercises (landmark triples chosen WITH A — 15 min pairing),
instructions/cues from T04 copy. Set up axe DevTools; post the §7 checklist as the PR
template.
**AC:** both `ExerciseDef`s type-check; A confirms landmark indices against live spike.

### T22 · C+D · Exercise library: filtered to the person · **M (3h)** · needs T10
Enrich the seeded exercise library so it can be filtered and explained as "matched to
you," not merely listed. Extend shared exercise metadata with `category`,
`tracking_modes`, and `metric_logged` while preserving existing position/equipment/body
region/intensity fields. Normalize tracking modes to `camera_manual`, `timer`, and
`manual`; camera-enabled exercises must always keep manual completion available. Seed
or update exercises from the reference table: seated/standing/lying options, wheelchair
and mobility-aid entries, timer-based routines, manual-only entries, and pool-access
examples where they fit app scope. Update workout filtering so generated workouts only
receive exercises compatible with the profile's positions/equipment and excluded
regions, and keep all labels practical, accessible, and free of form-correction or
judgment language.
**AC:** `types.ts` has strict unions/types for category, tracking modes, and metrics
with no `any`; `lib/exercises.ts` includes the reference-table exercises or equivalent
seeded entries; filter helpers return only exercises compatible with selected
positions/equipment and avoided regions; the library includes at least one seated
camera/manual exercise, one timer exercise, and one manual-only exercise; the AI route
prompt receives only filtered exercises and includes tracking/metric metadata; unit
tests cover profile filtering and tracking-mode metadata.

---

## SUNDAY AM — integration day

### 🔴 T11 · A+B pair (1h) then B solo · Real provider swap + exercise screen · **L (3.5h)** · needs T05–T07, T09, T10
A wraps `angles/smoothing/repCounter` into `realProvider.ts` implementing `PoseProvider`
(≈1h, pairing with B). B builds `/exercise`: live tracker, rep counter display, `RangeArc`
(arc drawn to personal target), voice announcements on `RepEvent`s, pause (big button),
manual "done" fallback.
**AC:** end-to-end calibrate → exercise → reps counted live on a real human on camera,
voice counting aloud. **This is the moment the app exists. Everyone drops P1 work if it slips.**

### T12 · C · Summary screen · **M (2h)** · needs T08
`/summary` from `SessionSummary`: reps, peak angle vs. personal range (simple visual),
one warm celebration line, "go again" / "recalibrate".
**AC:** reachable from exercise flow; renders from store; no dead ends.

### T13 · A · Exercise #2 + single-limb + robustness · **M (2.5h)** · needs T11
Tune torso-twist triple/thresholds; `side: "left"|"right"` selection tracks one side only
(never compares sides); visibility gating verified seated-in-frame and partially occluded.
**AC:** both exercises count reliably on 2 different team members' bodies.

### T14 · D · Accessibility pass #1 + hallway test · **M (2h)** · needs T11 partial
Keyboard-only run of full path; axe on all screens (0 contrast violations); VoiceOver
spot-check; one hallway test with someone outside the team. File issues as tickets.
**AC:** issue list posted and triaged (fix-now vs. won't-fix) by 2pm.

---

## SUNDAY PM — polish, wow, freeze (8pm)

### T15 · A · Demo-condition tuning · **M (2h)**
Test under venue-like lighting/angles; tune α and visibility threshold; add camera-framing
guidance UI trigger (uses D's reframing copy).
**AC:** reliable counting in the worst lighting you can simulate; constants documented.

### T16 · B · Degraded states + polish · **M (2h)**
Every screen: loading, camera-denied, model-load-failure. `prefers-reduced-motion`
respected incl. skeleton overlay. Mobile 390px sanity pass (demo is laptop, but it must
not embarrass on a phone).
**AC:** kill the camera mid-session → app degrades gracefully, never blames the user.

### T17 · C · ONE wow factor · **M (2.5h)** · **gate: F1–F4 all green, else skip**
Team picks at Sunday standup: **W1** voice control (5-phrase `SpeechRecognition` grammar,
Chrome-only OK, feature-detected) **or** **W2** AI debrief (`app/api/debrief/route.ts`,
zod-validated, templated fallback on failure — screen never breaks).
**AC (W1):** "start/pause/next" work hands-free on the demo laptop.
**AC (W2):** debrief renders on summary; unplug network → fallback renders.

### T18 · D · Backup video + freeze enforcement · **M (2h)**
Record a clean full-path screen capture under good conditions (the insurance policy).
**Feature freeze 8pm** — D has authority to reject any post-8pm feature PR.
**AC:** video in the team drive AND on the demo laptop locally; freeze announced.

### T19 · ALL · Bug bash · 8–10pm
Everyone runs the full demo path twice on different machines. Fix-only mode.
**AC:** zero blockers on the demo path; known issues listed with workarounds.

---

## MONDAY AM — pitch (done by 11am, hard stop)

### T20 · D (+input all) · Pitch deck · **M (2h)**
Problem → live demo → calibration differentiator ("scored against YOUR range, on-device,
nothing uploaded") → segments as roadmap → WCAG 2.2 mention. ≤6 slides; the demo is the pitch.

### T21 · ALL · Rehearsals ×2 + venue test
Rehearse with live demo AND once with the backup video (know the switch move: if tracking
misbehaves, tap "done" manually and continue — make it look intentional). Test venue
Wi-Fi, lighting, projector. Presenter = whoever demos calibration best seated.
**AC:** two clean run-throughs; laptop charged; video queued; done by 11am.

---

## Dependency graph (critical path in bold)

```
T00 ─┬→ **T01 → T05 → T06 → T11 → T13 → T15 → T19 → T21**
     ├→ T02 → T07 ─────────↗
     ├→ T03 → T08 → T12 ───→ T14 → T17
     └→ T04 → T09, T10 ────↗         T18 → T20
```

## Load check (≈ hours of ticketed work vs. ~14h realistic per person)

| | Sat | Sun | Mon | Total |
|---|---|---|---|---|
| A | 5.5 | 5.5 | reh. | ~11 🔴 heaviest — B is A's designated swarm partner |
| B | 5 | 4.5+2 | reh. | ~11.5 |
| C | 6 | 4.5 | reh. | ~10.5 |
| D | 4.5 | 4 | 2 | ~10.5 + floater |

Slack is intentional: pose-tracking estimates are the least trustworthy, and rested
people demo better. If everything lands early, add the RangeArc skeleton-overlay polish
(AGENTS.md §9 bonus) — never new scope.
