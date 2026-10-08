---
phase: 03-mobile-first-shell
plan: 13
subsystem: infra
tags: [railway, deploy, smoke-test, ci, vercel, lockfile]
requires: ["03-01", "03-02", "03-12"]
provides:
  - "Phase 3 backend live on Railway (onboarding + zapier_webhooks migrations applied)"
  - "scripts/smoke-prod.sh check 11 (currency allow-list and onboarding contract)"
  - "Frontend live on Vercel with manifest and install icons; CI green"
key-files:
  modified: [scripts/smoke-prod.sh, frontend/package-lock.json]
requirements-completed: [MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06]
completed: 2026-10-09
---

# Phase 3 Plan 13: Ship and verify Summary

Backend deployed to Railway `kitcha` first and verified live, then main pushed; CI and Vercel green, manifest and icons served.

## Local gates
- Backend (throwaway Postgres): jest 30 suites / 437 tests passed, `tsc --noEmit` clean, lint 0 errors (142 warnings), build OK.
- Frontend: lint 0 errors (136 warnings), type-check clean, vitest 6 files / 79 tests, `NEXT_PUBLIC_API_URL=https://x.example next build` OK.
- `bash -n scripts/smoke-prod.sh` OK; no `echo ... $TOKEN`.
- Static gates all empty (vh/h-screen, the peso sign, `'PHP'` in app/components, `'PHP'` in lib outside currency, dangerouslySetInnerHTML); EmptyState file count = 5.

## Deployment
- `railway status` showed project kitcha / production before any mutation; always `--service kitcha-api`. No variables set or printed; no other project touched. Deployed while local main was ahead of origin by 63 commits (backend-first).
- Deployment id 34a7d7c1-0dba-4e47-a4bb-f2f422df6826, SUCCESS (previous 4f637c51-d9dd-43ee-875c-2da0b2b9b458).
- Logs: "7 migrations found", "Applying migration `20261010000000_user_onboarding`", "Applying migration `20261010010000_zapier_webhooks`", "All migrations have been successfully applied.", "Starting application...".
- `/health` 200.

## Smoke (`--api-only`, run once)
Checks 1-7, 9a, 10a, 10b PASS; 9 live AI SKIP (not run); 11a-11d PASS (onboardingCompletedAt present, XXX rejected 400, jpy normalised to JPY then reset to PHP, onboarding/complete idempotent). Smoke user smoke+1791491087@example.com remains in the DB.

## CI and Vercel
- Final CI run (success: backend, frontend incl. npm test, docker-build): https://github.com/ervenderr/Smart-Grocery-Meal-Planner/actions/runs/37839853076, head 7b51843.
- Vercel commit status for 7b51843: success.
- Live: `/manifest.webmanifest` has `display: standalone`, `start_url: /dashboard`; `/apple-touch-icon.png` 200; `/icons/icon-maskable-512.png` 200.

## Deviations from Plan

**1. [Rule 3 - Blocking] CI `npm ci` failed: lock missing vite-nested lightningcss 1.33.0 platform bindings**
- Found: first CI run (37839275254). Fix: added 11 `node_modules/vite/node_modules/lightningcss-*` entries (from registry metadata) to frontend/package-lock.json. Commit a3bbe04. Owning plan: 03-01 (hand-merged lock).

**2. [Rule 3 - Blocking] CI `npm test` failed: no native rolldown binding on linux**
- Found: second CI run (37839545377), vitest startup error. Fix: added the 15 `@rolldown/binding-*` 1.2.13 optional entries to the lock; verified a linux/x64/glibc `npm ci` in a scratch dir installs the bindings. Pure additions, no force push. Commit 7b51843. Owning plan: 03-01.

Note: npm 11 locally regenerates the lock without these entries when asked, but CI requires them; the additions are harmless locally (local `npm ci --dry-run` and tests pass).

## Commits
- e0504cb test(03-13): add currency and onboarding smoke check 11
- a3bbe04 fix(03-13): vite nested lightningcss bindings in lockfile
- 7b51843 fix(03-13): rolldown platform bindings in lockfile

## Self-Check: PASSED
