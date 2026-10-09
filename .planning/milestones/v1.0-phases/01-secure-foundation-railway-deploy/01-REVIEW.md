---
phase: 01-secure-foundation-railway-deploy
reviewed: 2026-10-08T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .github/workflows/ci.yml
  - backend/.env.example
  - backend/.eslintrc.cjs
  - backend/Dockerfile
  - backend/entrypoint.sh
  - backend/prisma/seed.ts
  - backend/src/app.ts
  - backend/src/config/cors.config.ts
  - backend/src/config/env.config.ts
  - backend/src/config/env.schema.ts
  - backend/tests/cors.test.ts
  - backend/tests/env.schema.test.ts
  - backend/tests/health.test.ts
  - backend/tests/trust-proxy.test.ts
  - backend/package.json
  - frontend/next.config.ts
  - frontend/lib/constants/api-routes.ts
  - frontend/eslint.config.mjs
  - scripts/smoke-prod.sh
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-08
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The phase hardens CORS, env validation, trust proxy, and the Docker/CI pipeline. Most of it is sound: trust proxy 2 keys correctly on the second-from-right XFF entry, error messages do not leak values, and the entrypoint uses `exec`. Two security defects remain. The Vercel preview regex can be matched by an attacker-controlled team slug. The production env guard can be bypassed through `FRONTEND_URL`.

## Critical Issues

### CR-01: Preview-origin regex allows other Vercel teams (CORS allowlist bypass)

**File:** `backend/src/config/cors.config.ts:30`
**Issue:** The branch alternative `-git-[a-z0-9-]+` is greedy and may contain hyphens. It is followed by `-${scope}`. Vercel team slugs are global and attacker-registrable. An attacker who creates a team `evil-ervenderrs-projects` with a project named `kitcha` and any branch gets `kitcha-git-x-evil-ervenderrs-projects.vercel.app`. That origin matches `^https://kitcha(-git-[a-z0-9-]+)?-ervenderrs-projects\.vercel\.app$`, because `[a-z0-9-]+` absorbs `x-evil`. The `credentials: true` CORS response is then echoed to an attacker-controlled origin. The existing tests do not cover this case; the closest, `evil-kitcha-...`, only covers a prefix.
**Fix:** The `<branch>-<scope>` boundary is ambiguous, so the regex alone cannot fix it. Choose one of:
- Drop the `-git-` wildcard and allow only exact hash previews plus explicitly listed origins.
- Pin the scope by verifying the deployment otherwise (for example, an explicit `PREVIEW_ORIGINS` allowlist).
- Require the scope token to be unambiguous, for example by forbidding branches that end in a hyphen-delimited suffix of the scope. This is not generally possible, so prefer the allowlist.

Add a regression test for `https://kitcha-git-x-evil-ervenderrs-projects.vercel.app`.

### CR-02: Production CORS guard bypassed via FRONTEND_URL

**File:** `backend/src/config/env.schema.ts:62-82, 98-101`
**Issue:** The `superRefine` that rejects `*` and `localhost` in production only inspects `CORS_ORIGIN`. `FRONTEND_URL` (`z.url()` accepts any scheme and path) is merged afterwards in `parseEnv` with no check. `FRONTEND_URL=http://localhost:3000` or a plain `http://` origin passes in production. The check is also a substring match on `localhost`, and it ignores `127.0.0.1`, `0.0.0.0`, `[::1]`, and non-HTTPS origins. Entries in `CORS_ORIGIN` are never validated as origins at all. A bare hostname or an entry with a path is accepted and silently never matches.
**Fix:** Validate every merged entry as an origin, and run the production check on the merged list.
```ts
const originSchema = z.string().refine((v) => {
  try { const u = new URL(v); return u.origin === v; } catch { return false; }
}, "must be a bare origin (scheme://host[:port])");
// in superRefine, after the merge: require https: and reject loopback hosts
```
Move the merge into the schema (a `transform` before `superRefine`) so the guard sees the final list.

## Warnings

### WR-01: HTTPS redirect trusts the Host header and uses 301 for all methods

**File:** `backend/src/app.ts:66-71`
**Issue:** `https://${req.header("host")}` reflects an unvalidated Host header (open redirect or host-header injection). A 301 also lets clients rewrite POST to GET, so non-GET requests lose their body or method instead of being retried correctly.
**Fix:** Use a configured canonical host (or `req.hostname` checked against an allowlist) and `308` for non-GET/HEAD requests.

### WR-02: Seed guard only checks NODE_ENV

**File:** `backend/prisma/seed.ts:10-15`
**Issue:** `prisma db seed` run from a developer shell with `DATABASE_URL` pointing at production, and `NODE_ENV` unset, creates a demo user with a known password (`Demo1234!`). The guard protects only the container, where `NODE_ENV=production` is set.
**Fix:** Also refuse when `DATABASE_URL` does not look local, or require an explicit `ALLOW_SEED=1`.

### WR-03: Smoke script silently aborts under `set -e` and `pipefail`

**File:** `scripts/smoke-prod.sh:145-147`
**Issue:** If a page has no `/_next/static/*.js` match (for example `/login` returns a 404 shell), `grep -oE` exits 1. With `pipefail`, the assignment `js_paths="...$(...)"` returns non-zero and the script exits with no FAIL message. The `|| continue` on line 152 also hides failed chunk downloads.
**Fix:** Append `|| true` inside the command substitution. Make a failed chunk fetch increment a warning counter instead of continuing silently.

### WR-04: Smoke script bundle check is fragile

**File:** `scripts/smoke-prod.sh:140`
**Issue:** `API_HOST="${API#https://}"` leaves the full URL if `API` is `http://...`, so the check always fails. Check 5 assumes the runner owns its rate-limit bucket (any other traffic from the same IP flakes it). Re-running more than a few times in 15 minutes can hit auth rate limits.
**Fix:** Strip `https?://`, and document or retry on rate-limit variance.

### WR-05: Docker build context and image hygiene

**File:** `backend/Dockerfile:44-47`, `backend/.dockerignore`
**Issue:** `.dockerignore` excludes `.env` but not `.env.*`, `tests`, or `*.pem`. These enter the builder stage via `COPY . .`. The runner copies the full `node_modules` including dev tooling. There is no `HEALTHCHECK`.
**Fix:** Add `.env.*`, `tests`, and `coverage` to `.dockerignore`. Consider `npm prune --omit=dev` in the builder, keeping `prisma`, which is in `dependencies`.

### WR-06: ESLint rule `ban-types` will fail on typescript-eslint v8

**File:** `backend/.eslintrc.cjs:11`
**Issue:** This is valid with `@typescript-eslint` ^6 but the rule was removed in v8. Lint only covers `src/**/*.ts`, so `tests/` and `prisma/` are never linted. The `no-explicit-any`, `no-unused-vars`, and `ban-ts-comment` rules are all downgraded to warn, so CI cannot gate on them.
**Fix:** Pin the plugin version intentionally and extend the lint glob to `tests` and `prisma`. Consider running `eslint --max-warnings` with a baseline.

## Info

### IN-01: Trust proxy 2 is spoofable when the app is reachable without the proxy chain

**File:** `backend/src/app.ts:44`
**Issue:** If the app is reached directly (local dev, Railway private networking), a client-supplied `X-Forwarded-For: spoof` yields `req.ip = spoof`, because the socket and the single entry are both treated as trusted. The same applies to `X-Forwarded-Proto` for `req.secure`. This is acceptable only if Railway always overwrites these headers, which the smoke check verifies for XFF only.
**Fix:** Document the assumption. Optionally add a smoke check for `X-Forwarded-Proto`.

### IN-02: Origin passes the guard when it has a trailing slash

**File:** `backend/src/config/cors.config.ts:39-42, 62-64`
**Issue:** `normalizeOrigin` strips trailing slashes before comparison, but `cors` echoes the original (un-normalized) origin. Browsers never send one, so there is no security impact, but the behavior is more permissive than the allowlist semantic implies.
**Fix:** Compare strictly against the raw origin.

### IN-03: Frontend API URL not validated

**File:** `frontend/next.config.ts:5`, `frontend/lib/constants/api-routes.ts:6-8`
**Issue:** The build guard checks only for presence. A trailing slash or a missing scheme in `NEXT_PUBLIC_API_URL` produces `//api/v1/...` or relative URLs. It also fires for Vercel preview builds, which must have the variable set for Preview as well as Production.
**Fix:** Validate with `new URL()` and require `https:` in `PHASE_PRODUCTION_BUILD`; strip a trailing slash.

### IN-04: CI hygiene

**File:** `.github/workflows/ci.yml:39-40, 3-5`
**Issue:** Actions are pinned to mutable major tags (`@v7`, verify that these tags exist) rather than commit SHAs. The `push` and `pull_request` triggers run duplicate workflows for PR branches, because the concurrency group differs by ref. The workflow has no `npm audit` step.
**Fix:** Pin to SHAs, restrict `push` to `main`, and consider an audit step.

---

_Reviewed: 2026-10-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
