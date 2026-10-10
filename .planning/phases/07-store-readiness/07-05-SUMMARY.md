---
phase: 07-store-readiness
plan: 05
subsystem: frontend-account
tags: [account-deletion, settings, login, store-01]
requires: [backend DELETE /api/v1/users/me (plan 06)]
provides: [password-confirm delete flow, login deleted notice]
affects: [settings data tab, login page]
key-files:
  created:
    - frontend/lib/account/delete-account.ts
    - frontend/lib/account/delete-account.test.ts
    - frontend/lib/api/account.ts
    - frontend/components/settings/delete-account-sheet.tsx
    - frontend/components/settings/danger-zone-card.tsx
    - frontend/components/auth/deleted-account-notice.tsx
  modified:
    - frontend/components/settings/data-settings.tsx
    - frontend/app/(auth)/login/page.tsx
decisions:
  - Sheet form is a child component mounted only while the dialog is open, so password and error state reset on close without setState-in-effect.
metrics:
  completed: 2026-10-10
  tasks: 2
---

# Phase 7 Plan 05: Delete Account UI Summary

Password-confirmed in-app account deletion (Danger zone card, sheet, DELETE /api/v1/users/me with body), full client cleanup via clearAuth plus router.replace to /login?deleted=1, and a deletion notice on login.

## Commits
- RED: test(07-05) failing helper tests (9 cases)
- GREEN: feat(07-05) helpers and accountApi
- 3a1e2b3: feat(07-05) sheet, card, data-settings cleanup, login notice and legal links

## Deviations from Plan
None. One in-flight refactor: the first sheet version reset state in an effect, which tripped the react-hooks/set-state-in-effect lint warning, so the form was split into a child that unmounts on close.

## Verification
- vitest: 52 files / 727 tests pass (9 new).
- eslint on all plan files: 0 errors (remaining warnings are pre-existing `any` usage in data-settings and an unused import in login page).
- tsc: no errors in plan files. Pre-existing errors exist only in Phase 9 `lib/rules/substitutions.test.ts` (module not yet created by the other agent).
- `next build` deliberately not run (deferred to plan 12).
- Not exercised against a live backend (plan 06 endpoint).

## Known Stubs
None.

## Self-Check: PASSED
