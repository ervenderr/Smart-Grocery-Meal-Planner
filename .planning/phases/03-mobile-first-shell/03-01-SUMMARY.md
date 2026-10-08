---
phase: 03-mobile-first-shell
plan: 01
subsystem: ui
tags: [vitest, tailwind4, viewport, safe-area, dvh, ci]
requires: []
provides:
  - vitest harness (npm test) and CI step
  - isTextEntry() predicate
  - Tailwind 4 @theme tokens (animate-slide-up, animate-fade-in, shadow-soft)
  - pb-safe / pt-safe utilities, 16px inputs below 1024px, reduced-motion block
  - viewport export with viewportFit cover
affects: [03-02, 03-03, 03-04]
tech-stack:
  added: [vitest@5.0.3]
  patterns: [dvh for full-screen containers, node-environment unit tests for pure helpers]
key-files:
  created:
    - frontend/vitest.config.ts
    - frontend/lib/dom/is-text-entry.ts
    - frontend/lib/dom/is-text-entry.test.ts
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - .github/workflows/ci.yml
    - frontend/app/globals.css
    - frontend/app/layout.tsx
    - frontend/components/auth/protected-route.tsx
    - frontend/components/common/error-boundary.tsx
    - frontend/components/common/loading-spinner.tsx
key-decisions:
  - "vitest pinned exactly at 5.0.3 (legitimacy approved by orchestrator)"
  - "Reused existing top-level fadeIn keyframes; only slideUp added inside @theme"
requirements-completed: [MOB-02, MOB-03]
duration: 20min
completed: 2026-10-09
---

# Phase 3 Plan 01: Test harness and mobile viewport foundations Summary

Vitest with CI step, a test-first `isTextEntry` helper, missing Tailwind 4 tokens, safe-area/16px-input/reduced-motion CSS, edge-to-edge viewport, and dvh in the three shared full-screen components.

## Tasks
1. Package legitimacy checkpoint: approved by the orchestrator (npm: vitest 5.0.3, vitest-dev/vitest; registry shows no install scripts).
2. Vitest + isTextEntry (TDD): RED `455951e`, GREEN `d0aace8`. 21 tests pass.
3. Tokens, viewport, dvh: `a2f4e61`. Built CSS contains `slide-up`.

## Verification
`npm test` (21 pass), `type-check` clean, `lint` 0 errors (141 pre-existing warnings), `next build` succeeds with built CSS containing `slide-up`.

## Deviations from Plan

**1. [Rule 3 - Blocking] @types/node bumped ^20 to ^22**
- vitest 5.0.3 has an optional peer `@types/node ^22 || >=24`; `npm install` failed with ERESOLVE. Bumped to `^22.20.5` (matches CI Node 22) rather than using `--legacy-peer-deps`. This is the only package.json change besides vitest and the test script.

**2. [Rule 3 - Blocking] Lockfile missing rolldown native binding entries**
- npm optional-deps bug (npm/cli#4828): lock had no `@rolldown/binding-*` entries, so vitest could not start. Merged the 15 `@rolldown/binding-*` (and wasm helper) entries from a freshly resolved lock into the existing lock, avoiding a full regeneration (which bumped ~348 unrelated versions). Locally on darwin-arm64, `npm ci` still skipped the binding, so I ran `npm install --no-save @rolldown/binding-darwin-arm64@1.2.13` for local runs only. **Unverified:** that CI (linux-x64) `npm ci` installs `@rolldown/binding-linux-x64-gnu` from the merged lock. Check the first CI run.

**3. Minor:** `fadeIn` keyframes already existed at top level in globals.css with identical values, so they were not duplicated inside `@theme`.

## Issues
- None blocking. Local developers on Apple Silicon may need the `--no-save` binding install above if `npx vitest` reports "Cannot find native binding".

## Self-Check: PASSED
Files and commits 455951e, d0aace8, a2f4e61 exist.
