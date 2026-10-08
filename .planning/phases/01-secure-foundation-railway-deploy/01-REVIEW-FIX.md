---
phase: 01-secure-foundation-railway-deploy
fixed_at: 2026-10-08T00:00:00Z
review_path: .planning/phases/01-secure-foundation-railway-deploy/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Source review:** 01-REVIEW.md (Info findings out of scope)
**Verification:** backend suite 214/214 passing against a temporary local Postgres 16 (port 5544, since stopped and removed); `tsc --noEmit` clean; `npm run lint` 0 errors (168 pre-existing warnings). Docker is not available locally, so the image build was not exercised (see WR-05).

## Fixed Issues

### CR-01: Preview-origin regex allows other Vercel teams
**Status:** fixed: requires human verification
**Files:** `backend/src/config/cors.config.ts`, `backend/tests/cors.test.ts`
**Commit:** 1463446
The branch segment is now a single hyphen-free token (`-git-[a-z0-9]+`), so `kitcha-git-x-evil-ervenderrs-projects.vercel.app` no longer matches. Regression tests added. Trade-off: previews of hyphenated branch names (e.g. `feature-x`) are no longer auto-allowed and must be listed in `CORS_ORIGIN`. Residual risk: the hash and bare `<project>-<scope>` forms are inherently ambiguous with attacker-chosen team/project names (e.g. team `projects`, project `kitcha-ervenderrs`); no regex can remove that. The reviewer's allowlist-only option is the complete fix if that risk matters; leaving `VERCEL_PREVIEW_SCOPE` unset disables preview matching entirely.

### CR-02: Production CORS guard bypassed via FRONTEND_URL
**Status:** fixed: requires human verification
**Files:** `backend/src/config/env.schema.ts`, `backend/tests/env.schema.test.ts`
**Commit:** a1d6d2c
Every `CORS_ORIGIN` entry and `FRONTEND_URL` must be a bare http(s) origin (no path/query) in all environments. In production each must also be https and not localhost, `*.localhost`, `127.*`, `0.0.0.0` or `[::1]`. `*` is rejected as a non-origin. Tests added.

### WR-01: HTTPS redirect trusts Host header, uses 301
**Status:** fixed: requires human verification
**Files:** `backend/src/middleware/httpsRedirect.ts` (new), `backend/src/app.ts`, `backend/src/config/env.schema.ts`, `backend/src/config/env.config.ts`, `backend/.env.example`, `backend/tests/https-redirect.test.ts` (new), `backend/tests/health.test.ts`
**Commit:** f768fe0
Redirect now uses 308 to a configured host (`PUBLIC_HOST`, falling back to Railway's `RAILWAY_PUBLIC_DOMAIN`). With no host configured, it returns 400 rather than redirecting. Railway terminates TLS and `req.secure` is true behind it, so normal traffic is unaffected.

### WR-02: Seed guard only checks NODE_ENV
**Status:** fixed
**Files:** `backend/prisma/seed.ts`
**Commit:** 702ceac
Seed also refuses unless `DATABASE_URL` host is local (`localhost`, `127.0.0.1`, `[::1]`, compose hosts `postgres`/`db`) or `ALLOW_SEED=true` is set. Manually confirmed refusal for a remote URL.

### WR-03: Smoke script aborts silently
**Status:** fixed
**Files:** `scripts/smoke-prod.sh`
**Commit:** 1ab0942
`grep` no-match no longer trips `set -e`/`pipefail`; failed chunk downloads emit a WARN and are counted in the final failure message.

### WR-04: Smoke bundle check fragile
**Status:** fixed
**Files:** `scripts/smoke-prod.sh`
**Commit:** 224d145
Strips `http://` or `https://` from `API`; the rate-limit check retries up to 3 times to tolerate other traffic. Rate-limit window caveat documented in a comment.

### WR-05: Docker build context and image hygiene
**Status:** fixed: requires human verification (image not built, no Docker locally)
**Files:** `backend/.dockerignore`, `backend/Dockerfile`
**Commit:** c8bf11e
`.dockerignore` now excludes `.env.*` (keeping `.env.example`), `tests`, keys/pems and Docker files (tsconfig already excludes tests from the build). Builder runs `npm prune --omit=dev --ignore-scripts`. Simulated in a scratch copy: node_modules 249M to 177M, `node_modules/.bin/prisma`, the generated client and engines remain, and `prisma migrate status` works. `typescript`/`tsc-alias` are regular dependencies, so they stay. HEALTHCHECK intentionally not added (Railway ignores Dockerfile healthchecks and uses its service-level path). Non-root user and entrypoint unchanged.

### WR-06: ESLint ban-types / lint scope
**Status:** fixed
**Files:** `backend/.eslintrc.cjs`, `backend/package.json`, `backend/src/middleware/errorHandler.ts`
**Commit:** adb4b01
Removed the `ban-types` override (the rule is gone in v8; the recommended preset covers it on v6). Lint now covers `tests` and `prisma`. Un-masking the rule exposed one real error (`Function` type in `asyncHandler`), now typed as a handler signature. Not done: `--max-warnings` baseline gating, plugin version pin (left on ^6, which matches the installed ESLint 8).

## Skipped Issues

None.

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
