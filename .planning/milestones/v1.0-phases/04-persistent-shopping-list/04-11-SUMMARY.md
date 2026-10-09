---
phase: 04-persistent-shopping-list
plan: 11
subsystem: infra
tags: [railway, deploy, smoke-test, ci, vercel, shopping]
requires: ["04-01", "04-02", "04-03", "04-04", "04-05", "04-06", "04-07", "04-08", "04-09", "04-10"]
provides:
  - "scripts/smoke-prod.sh check 12 (persistent shopping list contract, 12a-12i)"
  - "Phase 4 backend live on Railway (migration 20261011000000_shopping_active_list_unique applied)"
  - "Frontend Shopping page live on Vercel; CI green"
key-files:
  modified: [scripts/smoke-prod.sh]
requirements-completed: [SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05]
completed: 2026-10-09
---

# Phase 4 Plan 11: Ship and verify Summary

Backend deployed to Railway `kitcha` first and verified live (migration applied, smoke check 12 passing), then main pushed once; CI and Vercel green.

## Local gates (own temp Postgres 16, port 5711, stopped and removed afterwards)
- Backend: jest 39 suites / 563 tests passed, `tsc --noEmit` clean, lint 0 errors (147 warnings), build OK, `prisma migrate diff --exit-code` -> "No difference detected" (exit 0).
- Frontend: lint 0 errors (131 warnings), type-check clean, vitest 19 files / 174 tests, `NEXT_PUBLIC_API_URL=https://x.example next build` OK.
- `bash -n scripts/smoke-prod.sh` OK; no `echo ... $TOKEN`; `--ai-live` handling untouched.
- Static gates all empty (vh/h-screen, peso sign, `'PHP'` in app/components, dangerouslySetInnerHTML in shopping, raw-unsafe queries in shopping module); no manifest/lockfile diff since 83f91f4; EmptyState file count = 5.

## Deployment
- `railway status` showed project kitcha / production before any mutation; always `--service kitcha-api`. No variables set or printed; no other project touched. Local main was ahead of origin by 61 commits at deploy time (backend-first).
- Deployment id c2d821d0-627b-4bad-ad99-4305eb7c5e7e, SUCCESS.
- Logs: "8 migrations found", "Applying migration `20261011000000_shopping_active_list_unique`", "All migrations have been successfully applied.", "Starting application...".
- `/health` 200.

## Smoke (`--api-only`, run once)
Checks 1-7, 9a, 10a, 10b, 11a-11d and 12a-12i all PASS; 9 live AI SKIP (not run). Smoke user smoke+1791497946@example.com remains in the DB.

## CI and Vercel
- Push: c01500b..adec29c (single push, no force). CI run (success: backend, frontend, docker-build): https://github.com/ervenderr/Smart-Grocery-Meal-Planner/actions/runs/37852724118, head adec29c.
- Vercel commit status for adec29c: success.
- `https://kitcha-ai.vercel.app/shopping` returned 200.

## Deviations from Plan
None. One self-inflicted hiccup: my first local test run used a JWT_SECRET containing "secret"/"test", which the env schema rejects as weak; rerun with a random hex secret passed.

## Commits
- adec29c test(04-11): add shopping smoke check 12

## Self-Check: PASSED
