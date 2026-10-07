---
phase: 01-secure-foundation-railway-deploy
plan: 05
subsystem: infra
tags: [railway, postgres, deploy, smoke-test, rate-limit, trust-proxy]
requires: ["01-01", "01-03"]
provides:
  - "Live Railway API at https://kitcha-api-production.up.railway.app"
  - "scripts/smoke-prod.sh production smoke test"
  - "Workspace usage cap (hard $10, soft $5)"
affects: ["01-06"]
key-files:
  created: [scripts/smoke-prod.sh]
  modified: [backend/src/app.ts, backend/tests/trust-proxy.test.ts]
key-decisions:
  - "trust proxy = 2: Railway overwrites X-Forwarded-For with '<real client>, <varying edge ip>'"
requirements-completed: [DEP-02, DEP-03, DEP-04, DEP-05, DEP-06]
duration: ~15min
completed: 2026-10-08
---

# Phase 1 Plan 05: Railway Deploy Summary

Live production API on Railway (project `kitcha`, Singapore, single replica, private Postgres), capped at hard $10 / soft $5, with a curl smoke test that passes end to end.

**Live API URL:** https://kitcha-api-production.up.railway.app (health: /health, API base: /api/v1)

## Spend cap
Before: no workspace limit. After: hard $10 (Railway minimum), soft $5, accepted on the first try.
The limit is workspace-wide, so it also covers nurse-quest, comfortable-grace, intuitive-surprise and medichain.

## Provisioned
- Project `kitcha` (id 54eed7b5-0881-4c1c-a122-a041e675a115), services `kitcha-api` and `Postgres`, environment production.
- Both services in Southeast Asia (asia-southeast1-eqsg3a), 1 replica each (verified via `railway environment config --json`).
- Other four projects untouched (still listed, no deployments from this plan).
- Variables set (names only): NODE_ENV, API_VERSION, LOG_LEVEL, JWT_EXPIRES_IN, CORS_ORIGIN, FRONTEND_URL (both https://kitcha-ai.vercel.app), VERCEL_PREVIEW_SCOPE, VERCEL_PREVIEW_PROJECT, DATABASE_URL (reference to Postgres), JWT_SECRET (openssl, piped via stdin, never echoed; `git grep` for it exits 1). PORT not set (Railway injects 8080).

## Railway CLI commands that worked (run from backend/, after confirming `railway status` shows kitcha)
```
railway usage limit set --target workspace --hard 10 --soft 5
railway init --name kitcha --workspace "Erven Idjad's Projects" --json
railway add --database postgres --json
railway add --service kitcha-api --json
railway service scale --service kitcha-api asia-southeast1-eqsg3a=1
railway service scale --service Postgres asia-southeast1-eqsg3a=1
railway variable set --service kitcha-api --skip-deploys NODE_ENV=production ... 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
openssl rand -hex 32 | railway variable set JWT_SECRET --stdin --service kitcha-api --skip-deploys
railway api 'mutation { serviceInstanceUpdate(serviceId:"<id>", environmentId:"<id>", input:{healthcheckPath:"/health"}) }'
railway up --service kitcha-api --detach --message "..."
railway domain --service kitcha-api --json
railway redeploy --service kitcha-api --yes
```

## Assumptions
- A1 (scale on a DB service sets region): HELD. Postgres scaled to Southeast Asia, 1 replica.
- A2 (DB service name): HELD. `Postgres`.
- A3 (trust proxy 1 is right): FAILED, see deviations.
- A5 (Prisma EACCES as non-root): HELD. No EACCES; migrations applied and app started with the unmodified Dockerfile.
- A9 (`environment edit ... deploy.healthcheckPath`): FAILED. The command returns "No changes to apply" (by service name and by id) and nothing is stored. The GraphQL `serviceInstanceUpdate` fallback worked and `environment config` now shows healthcheckPath /health. A further redeploy was SUCCESS with it set.
- Domain target port: null (auto-detect); traffic reaches the app on 8080, so no `domain update` needed.

## Verification
- Smoke test `API=... scripts/smoke-prod.sh --api-only`: checks 1-7 all PASS (health, CORS allow for prod and preview origins, 403 for evil origin, spoofed XFF shares one bucket 99 -> 98, signup 201, login 200, pantry create/get/patch/delete/404). Smoke users smoke+<epoch>@example.com remain in the DB (no delete endpoint).
- Migrations: first deployment log has "All migrations have been successfully applied." before the app boot lines (the aggregated log stream interleaves stdout/stderr; the entrypoint is sequential). Later deploys log "No pending migrations to apply."
- Graceful shutdown: previous deployment logs "SIGTERM received. Starting graceful shutdown...", "HTTP server closed", "Graceful shutdown completed".
- Frontend bundle check (smoke check 8) not run; belongs to plan 01-06.

## Commits
- bb7ecb9 test(01-05): add production smoke test script
- 1d4c082 fix(01-05): trust two proxy hops so rate limits key on the real client IP

## Deviations from Plan

**1. [Rule 1 - Bug] trust proxy 1 keyed rate-limit buckets on a varying edge IP**
- Found during: Task 3 (smoke check 5 failed: 99 -> 99).
- Evidence: a temporary debug route (never committed, removed and redeployed) showed Railway overwrites X-Forwarded-For with `<real client>, <edge ip>`, where the edge IP varies per request (152.233.x.x), and client-supplied values are stripped. With trust proxy 1, req.ip was the edge IP, so buckets were effectively random.
- Fix: `app.set("trust proxy", 2)` in backend/src/app.ts; updated backend/tests/trust-proxy.test.ts to the Railway format. Test passes locally; live check 5 now passes. Note: RESEARCH's "rightmost entry" model was wrong for Railway.
- Commit: 1d4c082

**2. [A9 fallback] healthcheck path set through GraphQL** (see Assumptions). No repo change.

## Deferred Issues
- Pre-existing: express-rate-limit logs ERR_ERL_KEY_GEN_IPV6 at startup for the AI limiter custom keyGenerator in backend/src/middleware/rateLimiter.ts (uses req.ip without `ipKeyGenerator`; IPv6 users could bypass that limiter). Non-fatal, out of scope; fix in a later plan.
- Subsequent backend deploys are manual `railway up` (no GitHub link).

## Threat Flags
None beyond the plan's threat model. Postgres TCP proxy not enabled; seed not run.

## Self-Check: PASSED
