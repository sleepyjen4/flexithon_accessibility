## What changed

<!-- One or two sentences. Link the ticket if there is one. -->

## Accessibility self-check (AGENTS.md §6 — non-negotiable, check every box)

- [ ] Touch targets are ≥ 48×48px; primary actions are full-width on mobile
- [ ] Text contrast ≥ 4.5:1 (large text ≥ 3:1) using only the AGENTS.md §6 design tokens
- [ ] Semantic HTML first (`<button>`, `<nav>`, `<main>`, correct heading hierarchy) — ARIA only where semantics can't do it
- [ ] Every interactive element is keyboard-operable with a visible focus ring
- [ ] State changes (timers, rep counts, save confirmations) announce via `aria-live="polite"`, not color alone
- [ ] Animations are gated behind `prefers-reduced-motion`
- [ ] Images have meaningful `alt`, or `alt=""` if decorative
- [ ] No autoplaying audio — TTS is user-triggered
- [ ] Copy avoids "just/simply/easy" and never guilt-trips; skipping is framed as valid
- [ ] Form inputs have visible `<label>`s; errors are announced and described in text
- [ ] Ran axe DevTools against every screen this PR touches — zero new violations

## Engineering conventions (AGENTS.md §7)

- [ ] TypeScript strict, no `any`
- [ ] Shared types added to `types.ts` only (checked for an existing type before adding one)
- [ ] No new dependency outside AGENTS.md §2 without team agreement
- [ ] Loading/error/empty states present on every screen that fetches data
- [ ] Verified at 390px mobile width

## Test plan

<!-- How you checked this works: manual steps, screenshots, or automated tests. -->
