# flexithon_accessibility

Alpha — a fitness app that adapts to your body and your energy today. See [AGENTS.md](./AGENTS.md) for the full product spec, tech stack, and conventions (read it before making changes).

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in Supabase + Anthropic credentials.
2. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS, Radix UI, Supabase, Anthropic API, Zustand, MediaPipe Pose. See [AGENTS.md](./AGENTS.md) § 2 for details — do not add dependencies outside this list without team agreement.

## Database

Apply `supabase/migrations/0001_init.sql` to a Supabase project to create the `profiles`, `exercises`, `checkins`, and `sessions` tables.

## Accessibility QA

Install the [axe DevTools](https://www.deque.com/axe/devtools/) browser extension and run it against every screen a PR touches before merging to `main` — zero new violations is the bar (AGENTS.md § 1.6 / § 6). This is a manual, per-PR check; see `.github/PULL_REQUEST_TEMPLATE.md` for the full self-check checklist.
