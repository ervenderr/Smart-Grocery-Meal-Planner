---
phase: 05-pantry-aware-intelligence
plan: 12
subsystem: infra
tags: [railway, deploy, smoke-test, ci, vercel, intelligence]
requires: ["05-01", "05-02", "05-03", "05-04", "05-05", "05-06", "05-07", "05-08", "05-09", "05-10", "05-11"]
provides:
  - "scripts/smoke-prod.sh check 13 (13a-13g: staples, cook-first, pantry-subtracted generate)"
  - "Phase 5 backend live on Railway (migration 20261012000000_user_staple_names applied)"
  - "Phase 5 frontend live on Vercel; CI green"
key-files:
  modified: [scripts/smoke-prod.sh]
requirements-completed: [INT-01, INT-02, INT-03, INT-04, INT-05]
completed: 2026-10-09
---

# Phase 5 Plan 12: Ship and verify Summary

Backend deployed to Railway `kitcha` first and verified live (migration applied, smoke checks 1-13 passing), then main pushed once; CI and Vercel green.

## Local gates (own temp Postgres 16, port 5812, stopped and removed afterwards)
- Backend: jest 51 suites / 934 tests passed (see note), `tsc --noEmit` clean, lint 0 errors (152 warnings), build OK, `prisma migrate diff --exit-code` -> "No difference detected" (exit 0).
- Frontend: lint 0 errors (118 warnings), type-check clean, vitest 31 files / 350 tests, `NEXT_PUBLIC_API_URL=https://x.example next build` OK. No frontend/AGENTS.md generated.
- Note: the very first backend jest run showed 1 failed test (of 934); two immediate reruns were 51/51 and 934/934. Not investigated further (looks like a timing flake); not reproduced.
- Static gates all empty (vh/h-screen, 'PHP', dangerouslySetInnerHTML, raw-unsafe queries, Decimal.set/decimal.js); no manifest/lockfile diff since 3f02fb7; only migration change since 3f02fb7 is the new 20261012000000_user_staple_names (no applied migration edited). `bash -n` OK, no `echo $TOKEN`, 42 lines mention 13a-g, `--ai-live` untouched.

## Deployment
- `railway status` showed project kitcha / production before any mutation; always `--service kitcha-api`. No variables set or printed; no other project touched. Local main was 66 commits ahead of origin at deploy time (backend-first).
- Deployment id be409195-4606-4f8a-bd9d-0418ea282201, SUCCESS.
- Logs: "9 migrations found", "Applying migration `20261012000000_user_staple_names`", "All migrations have been successfully applied.", "Starting application...", server started.
- `/health` 200.

## Smoke (`--api-only`, no --ai-live)
Final run: all checks 1-7, 9a, 10a, 10b, 11a-11d, 12a-12i and 13a-13g PASS (9 live AI SKIP). Smoke user smoke+1791550176@example.com remains in the DB.
Runs: three prior attempts did not complete (see deviations), leaving smoke users smoke+1791550076 (run 1, signup succeeded server-side) and one further user from run 2 in the DB.

## CI and Vercel
- Push: b1f1696..e3d3e08 (single push, no force). CI run (success): https://github.com/ervenderr/Smart-Grocery-Meal-Planner/actions/runs/37932629648, head e3d3e08.
- Vercel commit status for e3d3e08: success. `/dashboard` and `/settings` on kitcha-ai.vercel.app returned 200.

## Deviations from Plan
**1. [Rule 1 - Bug] Check 13c asserted a non-existent error code**
- Found during: Task 2 live smoke (run 2). The users module validation returns a generic 400 (`Validation failed: stapleNames: ...`) without `code: VALIDATION_ERROR` (that code exists only in the shopping module).
- Fix: 13c now asserts 400 and that `.message` mentions `stapleNames`, plus the stored list unchanged. Backend behavior untouched.
- Commit: see below.

**2. Smoke ran three times instead of once.** Run 1: client timeout (30s) on the signup response although the server logged 201 in ~1s; run 2: 13c assertion failure above; run 3: a client timeout on check 5 GET (server healthy, 200 in 0.13s); run 4 passed fully. Auth rate limit was not hit. All failures were client-side (timeout) or script assertion, none a backend defect.

## Commits
- 3fe0ec9 test(05-12): add intelligence smoke check 13
- e3d3e08 test(05-12): assert staples cap error by message

## Known Stubs
None.

## Self-Check: PASSED
