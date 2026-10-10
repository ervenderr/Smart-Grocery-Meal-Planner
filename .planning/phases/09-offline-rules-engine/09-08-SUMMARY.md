---
phase: 09-offline-rules-engine
plan: 08
subsystem: frontend-ui
tags: [nextjs, offline, react-query, navigation]
requires: [09-05, 09-07]
provides:
  - "/recipes/cook page (Cook from what you have)"
  - relativeTimeAgo helper
key-files:
  created:
    - frontend/app/(app)/recipes/cook/page.tsx
    - frontend/app/(app)/recipes/cook/cook-results-list.tsx
    - frontend/lib/rules/relative-time.ts
    - frontend/lib/rules/relative-time.test.ts
  modified:
    - frontend/lib/navigation.ts
    - frontend/lib/navigation.test.ts
    - frontend/app/(app)/recipes/page.tsx
    - frontend/components/dashboard/cook-first-card.tsx
key-decisions:
  - "Results list and show-more logic extracted to a colocated CookResultsList to keep page.tsx at 83 lines"
  - "Stale-data 'now' captured once via useState initializer (lint rule forbids Date.now() in render)"
requirements-completed: [OFF-08]
metrics:
  tasks: "1 of 2 (Task 2 human checkpoint PENDING)"
  completed: 2026-10-10
---

# Phase 9 Plan 08: Cook From What You Have Page Summary

Assembled the `/recipes/cook` page from the 09-06 hook and 09-07 components (filters, ranked rows, network-free Substitute sheet, recipe detail modal, empty/error/loading states), registered its page title ahead of `/recipes`, and added entry points on the Recipes header and the Home "Cook this first" card.

## Commits
- 1c54ce1 feat(09-08): add Cook from what you have page, nav title and entry points

## Verification (automated)
- `vitest run lib/navigation.test.ts lib/rules`: 15 files, 235 tests passed
- `npm run type-check`: clean
- `npm run lint`: 0 errors (118 pre-existing warnings)
- `next build` (with `NEXT_PUBLIC_API_URL` set; the config requires it for production builds): succeeds, `/recipes/cook` prerendered static
- Backend parity suites (units, diet, staples, cook-first): 4 suites, 118 tests passed
- Acceptance greps: no `fetch(`/toast/AISubstitutionModal/lib/api/ai in the new page files; title entry precedes `/recipes`; one `/recipes/cook` reference each in recipes page and cook-first card
- No Phase 7 files were staged or committed.
- Full `npm test`: 824/825. The single failure is `lib/rules/rank.bench.test.ts` (09-05) missing its desktop-scaled budget (median 31 ms vs 28.6 ms) while the machine was under load (load average ~6.5, concurrent agent and build). It passes when run alone (2 of 2, twice). Pre-existing timing flake, not caused by this plan; consider a more tolerant budget or serial run in a later plan.

## Deviations from Plan
- [Rule 1 - Bug] `Date.now()` in render tripped the react-hooks purity lint error; the timestamp is now captured once with a `useState` initializer.
- Added `lib/rules/relative-time.ts` (+ test) as the "small pure helper" the plan called for.
- Headless browser sanity check was not run; coverage is via the static build prerender and unit tests only.

## Scope Notes
- Cold-start offline (opening the app from a closed state with no network) is deferred to Phase 11. This plan covers only offline behavior after one online load, via the React Query cache (`offlineFirst`, 24h gcTime) and client-side navigation.

## Task 2: Human checkpoint - PENDING
Not yet verified by a human. Steps for the user:
1. Run `cd backend && npm run dev` and `cd frontend && npm run dev`; log in at http://localhost:3000 with an account that has pantry items (one expiring within 3 days) and several recipes.
2. On Home tap "See all you can cook"; confirm the title "Cook from what you have", ranking (Ready to cook first, then coverage), and the amber "Uses expiring" pill.
3. Tap "Why this ranking": check "In your pantry" need/have lines, "Using up soon", and "Missing" rows with "Find substitute" only where swaps exist.
4. Note the top 5 recipes. In DevTools > Network set "Offline". Navigate to Recipes, then back via the "Cook from what you have" button (client-side). Confirm same top 5, same order, no error.
5. Still offline, tap "Find substitute" (e.g. buttermilk, egg, sugar): sheet shows "Built-in swaps - no internet needed", scaled ratios, in-pantry swaps first, the disclaimer, and no new network requests.
6. Online, set a diet restriction (e.g. vegan) in profile; return to the page: conflicting recipes hidden while the "Hide recipes with excluded ingredients" chip is active; sheet shows "{n} hidden by your dietary settings" where applicable.
7. At 375 px width: sheet is a bottom sheet, chips scroll horizontally, buttons at least 44 px tall.
Reply "approved" or list issues (to be recorded for a gap-closure plan).

## Known Stubs
None.

## Self-Check: PASSED
Files exist and commit 1c54ce1 is in git log.
