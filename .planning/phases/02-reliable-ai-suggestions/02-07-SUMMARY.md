---
phase: 02-reliable-ai-suggestions
plan: 07
subsystem: infra
tags: [railway, deploy, smoke-test, ci, vercel]
requires: ["02-02", "02-03", "02-04", "02-05", "02-06"]
provides:
  - "Phase 2 backend live on Railway with ai_usage/ai_cache migration applied"
  - "scripts/smoke-prod.sh checks 9 (AI) and 10 (food) plus --ai-live mode"
key-files:
  modified: [scripts/smoke-prod.sh]
requirements-completed: [AI-01, AI-03, AI-04, AI-05, AI-07]
completed: 2026-10-09
---

# Phase 2 Plan 07: Ship and verify in production Summary

Smoke script extended with AI and food contract checks, all local gates green, backend deployed to Railway `kitcha`, main pushed with CI and Vercel green. AI_API_KEY is not set yet (02-08), and production stays healthy with the documented 503 AI_UNAVAILABLE.

## Local gates (temporary Postgres 16 on port 5607, removed afterwards)
- Backend: jest 26 suites / 372 tests passed, `tsc --noEmit` clean, lint 0 errors (warnings only), build OK.
- Frontend: lint 0 errors, type-check clean, `NEXT_PUBLIC_API_URL=https://x.example next build` OK.
- `bash -n scripts/smoke-prod.sh` OK; no `echo ... $TOKEN` in the script.

## Deployment
- Verified `railway status` showed project kitcha, environment production before any mutation; always used `--service kitcha-api`. No variables set or printed; no other project touched.
- Deployment id: c56bda13-1b94-4eeb-a168-bc35837dc9e0, status SUCCESS (previous: 2f002bf5-f759-4396-977d-de77c585a26f).
- Logs: "5 migrations found in prisma/migrations", "Applying migration `20261009120000_ai_usage_and_cache`", "The following migration(s) have been applied", "All migrations have been successfully applied.", "Starting application...". No ERR_ERL_KEY_GEN_IPV6 line found.
- `/health` returned 200.

## Smoke test (run once, `--api-only`)
Checks 1-7 PASS; 9a ai status 200 (provider dahl, available=false); 9 AI unavailable contract PASS (503 AI_UNAVAILABLE with message); 10a barcode 3017620422003 200 with ODbL attribution; 10b nutrition 503 LOOKUP_UNAVAILABLE (no USDA key, accepted form). Smoke user smoke+1791483692@example.com remains in the DB.

## CI and Vercel
- Pushed 0b3194f..185ba88 to main. CI run https://github.com/ervenderr/Smart-Grocery-Meal-Planner/actions/runs/37823675817: backend, frontend, docker-build all success.
- Vercel commit status for 185ba88: success; https://kitcha-ai.vercel.app returned 200. Check 8 (frontend bundle) was not re-run.

## Commits
- 185ba88 test(02-07): add AI and food checks to production smoke test

## Deviations from Plan
None. Plan executed as written. The deployment log stream is interleaved, so "Starting application..." is not strictly ordered after the migration line in the aggregated output (same as Phase 1); the entrypoint is sequential.

## Deferred
- `--ai-live` smoke and key setup belong to 02-08.

## Known Stubs
None.

## Self-Check: PASSED
