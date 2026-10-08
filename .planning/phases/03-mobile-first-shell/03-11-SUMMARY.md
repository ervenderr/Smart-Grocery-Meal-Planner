---
phase: 03-mobile-first-shell
plan: 11
subsystem: frontend-onboarding
tags: [onboarding, mobile, radix-dialog, tdd]
requires: [03-02, 03-05, 03-06]
provides: [first-run onboarding (MOB-05)]
affects: [frontend/app/(app)/layout.tsx]
key-files:
  created:
    - frontend/lib/onboarding/onboarding.ts
    - frontend/lib/onboarding/onboarding.test.ts
    - frontend/components/onboarding/onboarding-gate.tsx
    - frontend/components/onboarding/onboarding-flow.tsx
    - frontend/components/onboarding/step-budget.tsx
    - frontend/components/onboarding/step-dietary.tsx
    - frontend/components/onboarding/step-pantry.tsx
  modified:
    - frontend/app/(app)/layout.tsx
decisions:
  - Step titles are exported constants from each step file and rendered by the flow as the Radix Dialog.Title (single heading, accessible name).
  - Skip setup on the last step with items still only marks complete (does not create items); Finish creates them.
requirements: [MOB-05]
metrics:
  tasks: 3
  completed: 2026-10-09
---

# Phase 3 Plan 11: Onboarding Summary

First-run onboarding: a non-dismissible full-screen Radix dialog with 3 steps (budget + currency, dietary needs, first pantry items), skippable at any step, fail-open gate mounted in the app shell.

## Commits
- 01dfc9f test(03-11): failing onboarding logic tests (RED)
- 897ef9f feat(03-11): onboarding logic (GREEN, 13 tests)
- 6c02dc2 feat(03-11): three step components
- fc58a4d feat(03-11): flow, gate, layout mount

## Behavior
- `shouldShowOnboarding` is true only when `onboardingCompletedAt` is present and null; missing preferences, a missing key, or `isError` render nothing.
- Finish: `preferencesApi.update` (currency, dietary, optional budget), sequential `pantryApi.create` (unit `pieces`, quantity 1) tracked in `createdNames` so a retry never duplicates, then `completeOnboarding`, `setQueryData(PREFERENCES_QUERY_KEY)`, toast "You're all set! Welcome to Kitcha.", push `/dashboard`.
- Failures show the UI-SPEC error in a `role="alert"` and keep all progress; primary stays enabled.
- Escape, outside pointer and outside interaction are prevented.

## Deviations from Plan
None of substance. Added `onInteractOutside` prevention alongside the two specified handlers. Budget validation helper `budgetError` is exported from step-budget.tsx so the flow can block Continue on step 1.

## Verification
- `npm run lint`: 0 errors (pre-existing warnings only); `npm run type-check`: 0; `npm test`: 57 passed; `NEXT_PUBLIC_API_URL=https://x.example npx next build`: succeeded (first attempt hit "another next build running" from a parallel plan, passed on retry).
- Not manually verified in a browser; no component tests (vitest includes only lib/**/*.test.ts).

## Known Stubs
None.

## Self-Check: PASSED
All 7 created files exist; the four commits above exist in git log.
