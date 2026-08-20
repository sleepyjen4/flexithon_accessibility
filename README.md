# flexithon_accessibility

Alpha — a fitness app that adapts to your body and your energy today. See [AGENTS.md](./AGENTS.md) for the full product spec, tech stack, and conventions (read it before making changes).

## Getting Started

1. Copy `.env.example` to `.env.local` and add your `GEMINI_API_KEY` (optional — without it the workout generator falls back to a deterministic filter).
2. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS, Radix UI, Gemini API, Zustand, MediaPipe Pose. See [AGENTS.md](./AGENTS.md) § 2 for details — do not add dependencies outside this list without team agreement.

## Data

Alfa runs without an account. Your ability profile, calibration, and session history are
persisted in the browser (Zustand + `localStorage`), and camera frames are processed
on-device and never uploaded. Clearing site data clears your history.

`supabase/migrations/0001_init.sql` is kept as a design artifact — the schema and row-level
security policies for the accounts version, retained deliberately rather than deleted. It is
not wired to anything at runtime.

## Accessibility QA

Install the [axe DevTools](https://www.deque.com/axe/devtools/) browser extension and run it against every screen a PR touches before merging to `main` — zero new violations is the bar (AGENTS.md § 1.6 / § 6). This is a manual, per-PR check; see `.github/PULL_REQUEST_TEMPLATE.md` for the full self-check checklist.

## PR screenshots

```bash
npm run screenshots       # capture every route to .screenshots/ (gitignored)
npm run screenshots:pr    # capture, then attach them to this branch's PR
```

Puppeteer captures each static App Router route at 390×844 (the mobile-first target from
AGENTS.md § 7), with `prefers-reduced-motion` on so transitions are settled and the app's
own motion gating gets exercised. Routes are discovered from `app/**/page.tsx`, so a new
screen is picked up without touching the script. `localStorage` is seeded with a demo
profile and history so the dashboard and progress screens show real content — add
`--fresh` to capture the empty states instead, or `--only=/,/progress` to capture just the
screens a PR touches.

It reuses a dev server already on `:3000`, otherwise starts one on a free port and stops it
afterwards.

`--pr` commits the images to the orphan `pr-screenshots` branch and upserts a single
comment on the PR linking them by raw URL — GitHub has no API for uploading an image
directly to a comment, and this repo is public, so the raw URLs render inline. That branch
only ever holds screenshots and is never merged. Re-running updates the same comment
instead of adding another. Needs `gh` authenticated with `repo` scope and an open PR for
the current branch.

Screenshots are review context, not an accessibility sign-off — the axe and screen-reader
pass above still applies.
