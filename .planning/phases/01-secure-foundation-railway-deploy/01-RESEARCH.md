# Phase 1: Secure Foundation & Railway Deploy - Research

**Researched:** 2026-10-08
**Domain:** Brownfield deploy hardening: Express 4 + Prisma 5.22 on Railway (Docker), Next.js 16.0.2 -> 16.4.0 on Vercel, GitHub Actions CI
**Confidence:** HIGH on code changes, Next upgrade, CI and CLI syntax (all executed or read locally); MEDIUM on Railway runtime behaviour that can only be seen after the first deploy (client-IP hop count, Postgres region move, `environment edit` dot-paths)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hosting topology**
- Frontend stays on Vercel, already deployed at https://kitcha-ai.vercel.app. Phase sets `NEXT_PUBLIC_API_URL` in Vercel (via Vercel CLI if available, otherwise exact manual steps for the user) and redeploys.
- Backend + Postgres go in a NEW Railway project named `kitcha`, created via the Railway CLI. Region: Singapore if available. User sets the spend cap in the Railway dashboard (cannot be set via CLI); the plan must include that as an explicit manual checkpoint.
- No Render data to migrate: fresh empty Railway Postgres, `prisma migrate deploy` only. `render.yaml` is deleted.

**Backend platform fixes**
- `app.set('trust proxy', 1)`; `/health` registered before the HTTPS redirect, DB-free, never redirected.
- CORS: allowlist from env (`CORS_ORIGIN` comma-separated, normalized without trailing slash) that includes `https://kitcha-ai.vercel.app`, plus a pattern for Vercel preview URLs of this project; unknown origins get a 403/clean CORS rejection, not a 500.
- Env validated with Zod at startup, fail fast with a clear message; no hand-set `PORT` on Railway (use the injected one); remove `ENV PORT=10000` from the Dockerfile.
- Entrypoint runs the local prisma binary (not `npx`) then `exec node dist/index.js`. No `railway.toml`/`railway.json` (deprecated); healthcheck path configured through CLI/dashboard.
- Seed script refuses `NODE_ENV=production`. `.env.example` for backend and frontend documents every variable. Prisma pinned to an exact version matching the lockfile.
- Single replica only (in-process Zapier cron).

**Frontend**
- Upgrade `next` and `eslint-config-next` to 16.4.0 and React/React-DOM to the latest compatible 19.x (exact pins updated); build must pass.
- Production build fails if `NEXT_PUBLIC_API_URL` is unset (remove localhost fallback for production builds only).

**CI & verification**
- GitHub Actions: lint, type-check and tests for backend and frontend on every push/PR.
- End-to-end production smoke test after deploy: register, login, pantry create/read/update/delete against the Railway URL from the Vercel frontend.

### Claude's Discretion
Dockerfile/entrypoint details, CI workflow structure, Zod env schema layout, CORS preview-URL pattern, exact Railway variable references (verify `${{Postgres.DATABASE_URL}}` syntax with the CLI/docs first).

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.

**Specifics from CONTEXT:** User owns 4 unrelated Railway projects (nurse-quest, comfortable-grace, intuitive-surprise, medichain): never touch them. Railway CLI is v5.45.10 (newer available); only upgrade if needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-01 | Patched Next.js 16.4.0+ with matching React and eslint-config-next, builds cleanly | Section "Next.js upgrade" - upgrade executed in a scratch copy: `tsc` clean, `next build` passes, lint behaviour documented |
| DEP-02 | Backend live on Railway Hobby with Railway Postgres via CLI, spend cap set | "Railway runbook" - exact CLI commands checked against local `--help`; spend cap IS settable by CLI (correction to CONTEXT) |
| DEP-03 | Healthcheck passes: `/health` 200 without DB, never redirected | "Backend code changes" #1; Railway healthcheck facts; `healthcheckPath` set via `environment edit` or GraphQL |
| DEP-04 | Rate limits per real client IP (`trust proxy`) | Verified locally: `trust proxy 1` -> `req.ip` = rightmost XFF entry; spoofed leftmost values cannot mint new buckets |
| DEP-05 | CORS allowlist incl. Vercel preview pattern; env fail-fast | Zod 4.6.5 schema pattern tested; preview regex built from the real scope slug `ervenderrs-projects` |
| DEP-06 | Migrations without `npx`; app is PID 1 via `exec node` | Entrypoint + Dockerfile changes; local `prisma` bin verified (`node_modules/.bin/prisma` 5.22.0) |
| DEP-07 | Frontend build fails without `NEXT_PUBLIC_API_URL`; deployed frontend works end to end | `next.config.ts` phase guard tested (fails without var, passes with var); smoke-test script; Vercel sequencing hazard |
| DEP-08 | Seed refuses production; `render.yaml` removed; `.env.example` documents all vars | Seed guard + env example contents listed |
| DEP-09 | CI runs lint, type-check, tests for backend and frontend | CI YAML provided; baseline lint/test failures found and fixes specified |
</phase_requirements>

## Summary

The code changes are small and well understood, but the research found five things that will break the plan if they are not handled explicitly. (1) **CI would be red on day one**: the frontend has 98 ESLint errors today (112 after the upgrade, because eslint-plugin-react-hooks 7 adds rules), the backend has *no ESLint config at all* (`npm run lint` crashes), and `backend/tests/pantry.test.ts` has a time bomb (hardcoded `expiryDate: '2025-12-31'`, now in the past) that fails 4 of 163 tests. All three were reproduced locally and the fixes were verified. (2) **Vercel is Git-connected** (`vercel[bot]` creates a Production deployment for every push to `main`), so pushing the "fail build without `NEXT_PUBLIC_API_URL`" guard before the variable exists in Vercel produces a failed production build. Sequence the guard last. (3) **The spend cap can be set from the CLI** (`railway usage limit set --target workspace --soft N --hard N`), contradicting CONTEXT; but it is *workspace-wide* (a hard limit takes down all workloads in the workspace, including the 4 unrelated projects) and the minimum hard limit is $10, so the human checkpoint stays but it is about choosing values, not about the dashboard. (4) The Vercel project is named `kitcha` and its scope slug is `ervenderrs-projects` (read from the GitHub deployment status), so the preview-URL regex can be anchored to the owner's scope instead of a loose `kitcha-*.vercel.app` pattern that any stranger could register. (5) The `vercel` CLI is **not installed and not logged in**; the plan should use dashboard steps for the env var (or an interactive `vercel login` checkpoint).

Next.js 16.0.2 -> 16.4.0 is a same-major bump with no source changes needed: in a scratch copy, `npm install --save-exact next@16.4.0 eslint-config-next@16.4.0 react@19.3.0 react-dom@19.3.0` gave a clean `tsc --noEmit` and a passing `next build` (15 static routes). The only fallout is lint. Railway's Hobby workspace plan is already active (`plan: HOBBY` via the Railway API), `railway` v5.45.10 supports everything needed (no upgrade required), and Singapore is region `asia-southeast1-eqsg3a`.

**Primary recommendation:** Do the work in this order: backend hardening + CI (Wave 1) -> frontend upgrade without the build guard (Wave 2) -> Railway provision + first deploy + spend cap (Wave 3) -> set `NEXT_PUBLIC_API_URL` in Vercel -> push the build guard -> production smoke test (Wave 4). Treat lint config as part of CI work (warn-level rules, 0 errors), not as a refactor.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TLS termination, HTTP->HTTPS | Railway edge proxy | API (redirect fallback) | Edge sets `X-Forwarded-Proto: https`; app redirect is defence-in-depth and must exempt `/health` |
| Healthcheck | API (`/health`, DB-free) | Railway service setting | Railway probes the path from host `healthcheck.railway.app` and needs a 2xx |
| Client-IP rate limiting | API (`trust proxy 1` + express-rate-limit) | Railway edge (supplies XFF) | Limiter keys on `req.ip`; correct only if proxy trust matches the hop count |
| CORS allowlist / origin 403 | API | - | Cross-origin Bearer-token API; no cookies, so only `Origin` + `Authorization` handling |
| Env validation | API process start (Zod) | Railway variables | Fail fast before listen; Railway only injects values |
| Migrations | API container entrypoint | Railway Postgres | Single replica, `prisma migrate deploy` before `exec node` |
| `NEXT_PUBLIC_API_URL` inlining | Frontend build (Vercel build step) | Vercel env settings | Inlined at build time; must exist at build, runtime changes have no effect |
| Static frontend serving | Vercel CDN | - | Unchanged |
| Data persistence | Railway Postgres (private network URL) | - | Private `*.railway.internal` URL only reachable from inside the project |
| CI gates | GitHub Actions | - | Lint, type-check, tests (backend with Postgres service), build |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.0 (exact) | Frontend framework | `npm view next version` = 16.4.0 [VERIFIED: npm registry, 2026-10-07]; engines node >=20.9 |
| eslint-config-next | 16.4.0 (exact) | Lint preset | Must match next [VERIFIED: npm registry] |
| react / react-dom | 19.3.0 (exact) | UI runtime | npm latest; next 16.4.0 peer range is `^19.0.0` [VERIFIED: npm view next@16.4.0 peerDependencies] |
| zod | 4.6.5 (`^4.6.5`) | Backend env + CORS config validation | Already used in frontend (`^4.1.12`); `z.prettifyError` and `z.coerce` verified locally [VERIFIED: ran against zod@4.6.5] |
| prisma + @prisma/client | 5.22.0 (exact, both) | ORM + migrate CLI | Lockfile already resolves both to 5.22.0 [VERIFIED: package-lock.json]; npm latest is 7.x/8-rc, upgrade out of scope |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/checkout | v7 (latest v7.0.1) | CI checkout | [VERIFIED: `gh api repos/actions/checkout/releases/latest`] |
| actions/setup-node | v7 (latest v7.0.0) | CI Node + npm cache | [VERIFIED: gh api] |
| vercel (CLI) | 62.7.0 | Optional: env + redeploy from terminal | Only if user accepts an interactive `vercel login`; dashboard steps are the default [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel CLI | Vercel dashboard | CLI not installed/logged in; dashboard needs zero tooling. Use dashboard by default |
| `railway.toml` | CLI/GraphQL healthcheck | Locked: config-as-code is deprecated (legacy files read until 2026-12-01) [CITED: docs.railway.com/reference/config-as-code] |
| Railway `preDeployCommand` | entrypoint migrate | Locked: entrypoint (it exists as `ServiceInstanceUpdateInput.preDeployCommand` in the API schema, but decision is entrypoint) |

**Installation:**
```bash
# backend/
npm install --save-exact prisma@5.22.0 @prisma/client@5.22.0
npm install zod@^4.6.5
# frontend/
npm install --save-exact next@16.4.0 eslint-config-next@16.4.0 react@19.3.0 react-dom@19.3.0
```

**Version verification:** `npm view next version` = 16.4.0, `react` = 19.3.0, `zod` = 4.6.5, `vercel` = 62.7.0 (2026-10-08). `npm view prisma@5 version` tops out at 5.22.0.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| zod | npm | 6.6 yrs (created 2020-03-07) | ~387M/wk | github.com/colinhacks/zod | [OK] (slopcheck 0.6.1 `scan --pkg npm zod`) | Approved. New to backend only; already a frontend dependency. No postinstall |
| vercel | npm | 6.6 yrs | - | github.com/vercel/vercel | [OK] (slopcheck) | Approved but optional; no postinstall script |
| next, react, react-dom, eslint-config-next, prisma, @prisma/client | npm | already installed in repo | - | - | not rescanned (existing lockfile deps, version bumps only) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Phone / browser
   |
   |  HTTPS  (https://kitcha-ai.vercel.app)
   v
Vercel (git-connected, builds on every push to main)
   |  NEXT_PUBLIC_API_URL inlined at BUILD time
   |
   |  fetch + "Authorization: Bearer <jwt>"  (cross-origin, Origin: https://kitcha-ai.vercel.app)
   v
Railway edge proxy  --(terminates TLS; sets X-Forwarded-Proto, X-Real-IP; appends client IP to X-Forwarded-For)-->
   |
   v
kitcha-api container (single replica, PID 1 = node)
   entrypoint.sh: prisma migrate deploy (retry) -> exec node dist/index.js
   |
   |-- Express createApp()
   |     1. trust proxy = 1
   |     2. GET /health  (no DB, no redirect, no CORS)   <-- Railway healthcheck probe
   |     3. HTTPS redirect (prod only, uses forwarded proto)
   |     4. origin guard: Origin present && not allowed -> 403 JSON
   |     5. helmet, cors(allowlist), apiLimiter (per req.ip), body parsers, morgan
   |     6. /api/v1/* routes -> controllers -> Prisma
   |     7. notFound, errorHandler
   |-- Zapier node-cron scheduler (in-process => replicas must stay 1)
   |
   v  (private network: ${{Postgres.DATABASE_URL}}, *.railway.internal)
Railway Postgres  (fresh, empty; schema from 4 committed migrations)

GitHub push/PR --> Actions: backend job (Postgres service, migrate, lint, tsc, jest)
                            frontend job (lint, tsc, next build)
                            docker-build job (build backend image)
```

### Recommended Project Structure
```
backend/
├── src/config/
│   ├── env.schema.ts     # NEW: pure Zod schema + parseEnv(raw) (no side effects, unit-testable)
│   ├── env.config.ts     # dotenv load -> parseEnv(process.env) -> frozen `config`
│   └── cors.config.ts    # NEW: normalize origins, preview regex, originGuard + cors options
├── tests/
│   ├── env.schema.test.ts   # NEW
│   ├── cors.test.ts         # NEW
│   ├── health.test.ts       # NEW (NODE_ENV=production, no DB)
│   └── trust-proxy.test.ts  # NEW
├── .eslintrc.cjs         # NEW (ESLint 8 legacy config)
├── .env.example          # UPDATED
├── Dockerfile, entrypoint.sh   # UPDATED
.github/workflows/ci.yml  # NEW (repo root)
scripts/smoke-prod.sh     # NEW (repo root): curl-based production smoke test
frontend/.env.example     # NEW
```

### Pattern 1: Zod env schema as a pure function
**What:** `parseEnv(raw: NodeJS.ProcessEnv)` returns a typed config or throws one readable error. `env.config.ts` calls it once at module load.
**When to use:** Always; keeps tests free of module-load side effects.
**Example:**
```typescript
// Source: verified by running against zod@4.6.5 (prettifyError, coerce, transform, superRefine)
import { z } from "zod";

const WEAK = ["your-super-secret-jwt-key-change-this-in-production", "change-this", "secret", "jwt-secret", "default"];

const origins = z
  .string()
  .default("http://localhost:3000")
  .transform((s) => s.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).optional(),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
    JWT_SECRET: z.string().min(32, "must be at least 32 characters")
      .refine((v) => !WEAK.some((w) => v.toLowerCase().includes(w)), "looks like a default/weak value"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    API_VERSION: z.string().default("v1"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),
    CORS_ORIGIN: origins,
    FRONTEND_URL: z.string().url().optional(),
    VERCEL_PREVIEW_SCOPE: z.string().regex(/^[a-z0-9-]+$/).optional(), // e.g. ervenderrs-projects
    VERCEL_PREVIEW_PROJECT: z.string().regex(/^[a-z0-9-]+$/).default("kitcha"),
    GEMINI_AI_API_KEY: z.string().optional(),
    SPOONACULAR_API_KEY: z.string().optional(),
    ZAPIER_WEBHOOK_URL: z.string().url().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production") {
      if (v.PORT === undefined) ctx.addIssue({ code: "custom", path: ["PORT"], message: "required in production (Railway injects it; do not set by hand)" });
      if (v.CORS_ORIGIN.some((o) => o === "*" || o.includes("localhost"))) ctx.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: "must be explicit https origins in production" });
    }
  });

export function parseEnv(raw: NodeJS.ProcessEnv) {
  const r = envSchema.safeParse(raw);
  if (!r.success) throw new Error(`Invalid environment configuration:\n${z.prettifyError(r.error)}`);
  return r.data;
}
```
Never echo values in the error (the old code printed all env var names; `prettifyError` prints only paths and messages). Treat `FRONTEND_URL` as an additional allowed origin (union with `CORS_ORIGIN`) so setting either works; this removes the "FRONTEND_URL is only a warning" trap.

### Pattern 2: Origin guard returning 403, plus cors with the same predicate
**What:** A small middleware placed *before* `cors()` that rejects any request carrying a disallowed `Origin` with a JSON 403, so server-side side effects do not run for hostile browsers (`callback(null,false)` alone would still execute simple POSTs, the browser merely hides the response).
**Example:**
```typescript
// backend/src/config/cors.config.ts
export function buildOriginPredicate(opts: { origins: string[]; previewProject: string; previewScope?: string }) {
  const exact = new Set(opts.origins);
  // Vercel generated URLs: <project>-<9char hash>-<scope>, <project>-git-<branch>-<scope>, <project>-<scope>
  const preview = opts.previewScope
    ? new RegExp(`^https://${opts.previewProject}(-git-[a-z0-9-]+|-[a-z0-9]{9})?-${opts.previewScope}\\.vercel\\.app$`)
    : null;
  return (origin: string) => exact.has(origin) || (preview?.test(origin) ?? false);
}

export const originGuard = (isAllowed: (o: string) => boolean): RequestHandler => (req, res, next) => {
  const origin = req.header("origin");
  if (!origin || isAllowed(origin)) return next();
  res.status(403).json({ status: "error", statusCode: 403, message: "Origin not allowed" });
};
// app.ts: app.use(originGuard(isAllowed)); app.use(cors({ origin: (o, cb) => cb(null, !o || isAllowed(o)), credentials: true, ... }))
```
Vercel URL format [CITED: vercel.com/docs/deployments/generated-urls]. Scope slug `ervenderrs-projects` and project name `kitcha` [VERIFIED: GitHub deployment status for this repo returned `https://kitcha-94293z3ib-ervenderrs-projects.vercel.app`; the hash `94293z3ib` is 9 chars]. `https://kitcha-ai.vercel.app` is an alias and goes in `CORS_ORIGIN` as an exact entry. Anchoring on the owner scope is what stops `kitcha-evil.vercel.app` from another account matching. Vercel can truncate long branch labels (63-char DNS limit), which would fail the branch form; that only affects previews of very long branch names.

### Pattern 3: Entrypoint with local prisma binary, retry, and exec
```sh
#!/usr/bin/env sh
set -e
echo "Running database migrations..."
attempt=1
until ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma; do
  if [ "$attempt" -ge 5 ]; then echo "Migrations failed after $attempt attempts" >&2; exit 1; fi
  attempt=$((attempt + 1)); echo "Retrying migrations (attempt $attempt)..."; sleep 3
done
echo "Starting application..."
exec node dist/index.js
```
`./node_modules/.bin/prisma` is a symlink to `../prisma/build/index.js` and reports 5.22.0 [VERIFIED locally]. `prisma` is in `dependencies` (not dev), so it survives into the runner stage. The retry loop is defensive against private-network DNS not being ready at first start [ASSUMED: community-known; Railway docs only say private networking exists at runtime, not build, and advise running migrations in the start command - CITED: docs.railway.com/networking/private-networking/how-it-works]. A real migration failure (e.g. P3009) still exits non-zero after 5 tries.

### Anti-Patterns to Avoid
- **`trust proxy: true`:** express-rate-limit flags permissive trust (ERR_ERL_PERMISSIVE_TRUST_PROXY) and allows XFF spoofing. Use the number `1`.
- **Parsing the leftmost XFF entry yourself:** clients can set it (community reports say Railway does not strip client-supplied values). `trust proxy 1` reads the rightmost entry, which Railway appended.
- **Setting `PORT` on Railway:** Railway injects it; a manual value that differs from the domain's target port gives 502.
- **Putting `${{Postgres.DATABASE_URL}}` in double quotes in a shell:** `$` expansion mangles it; always single-quote.
- **`DATABASE_PUBLIC_URL` for the app:** adds egress cost and latency; private URL only.
- **Adding `railway.json`/`railway.toml`:** deprecated, new projects cannot opt in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env parsing/coercion/error formatting | Manual `required = [...]` loops | Zod `safeParse` + `z.prettifyError` | Types, coercion, one readable error, testable |
| Per-IP throttling | Custom counters | existing `express-rate-limit` with `trust proxy 1` | Already installed; only misconfigured |
| CORS header logic | Hand-written `Access-Control-*` | `cors` package + a 403 guard in front | Preflight edge cases (OPTIONS, `Vary: Origin`) |
| Migration orchestration | Custom wait/lock scripts | `prisma migrate deploy` (advisory lock) + small shell retry | Prisma already serializes concurrent runs |
| Preview-URL detection | Substring/`endsWith('.vercel.app')` | Anchored regex with owner scope | Substring checks let any Vercel user in |
| Production smoke test | Playwright suite | ~60-line curl script + one manual browser pass | Cheap, runs from anywhere, CORS can be exercised by sending `Origin` |
| Secret generation | Hand-typed strings | `openssl rand -hex 32` | 64 hex chars can never contain the weak substrings (`secret`, `default`, ...) |

**Key insight:** every problem here is configuration of tools already in the repo. The only new dependency is Zod in the backend.

## Runtime State Inventory

Not a rename/refactor phase, but it is a platform migration; answered explicitly for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None to migrate. CONTEXT: no Render data; Railway Postgres starts empty; the 4 migrations in `backend/prisma/migrations` create the schema | `prisma migrate deploy` only. Do NOT run the seed in production |
| Live service config | Vercel project `kitcha` (alias kitcha-ai.vercel.app) may already have a `NEXT_PUBLIC_API_URL` value pointing elsewhere or none; unknown (no CLI access) | Check dashboard; set Production + Preview to the Railway URL |
| OS-registered state | None | None - verified: no local launchd/pm2 involvement |
| Secrets/env vars | Render env (`JWT_SECRET` etc.) is not reused; new `JWT_SECRET` generated for Railway. `render.yaml` used `CORS_ORIGIN: "*"` (must not be carried over) | Generate new secret via `--stdin`; new Gemini key set later in Phase 2 |
| Build artifacts | `backend/render.yaml`; Render mentions in `backend/README.md` (line ~328 "Deploy to Render/Railway") and comment in `env.config.ts` line 16 | Delete file; update README deploy section and comment |

## Common Pitfalls

### Pitfall 1: Pushing the build guard before Vercel has the variable
**What goes wrong:** Vercel builds every push to `main` as Production (confirmed: all recent GitHub deployments are `Production` by `vercel[bot]`). A guard that throws without `NEXT_PUBLIC_API_URL` makes that build fail; Vercel keeps serving the previous deployment, so nothing breaks visibly but the new frontend never ships.
**How to avoid:** Order: Railway live -> set Vercel var (Production AND Preview) -> push guard. In CI set a dummy `NEXT_PUBLIC_API_URL` for the build step.
**Warning signs:** Vercel deployment "Error" with `NEXT_PUBLIC_API_URL must be set`.

### Pitfall 2: CI red on day one (three independent causes)
**What goes wrong / how to avoid:**
- Frontend `eslint .` exits 1 (98 errors baseline; 112 after upgrade; 39 files). Add rule overrides in `eslint.config.mjs` that downgrade `no-explicit-any`, `no-unused-vars`, `react/no-unescaped-entities` and the new react-hooks v7 rules to `warn` (verified: 0 errors, 146 warnings, exit 0). Do not refactor 39 files in this phase.
- Backend `npm run lint` crashes: no ESLint config exists. Add `.eslintrc.cjs` (config below; verified 0 errors, 157 warnings) and quote the glob: `eslint "src/**/*.ts"`.
- `tests/pantry.test.ts` uses `expiryDate: '2025-12-31'` -> `isExpired` is now true and the follow-up tests cascade into 400s (4 failures of 163). Replace with dates computed relative to now (e.g. +30 days). Also review `mealplan.test.ts` (2025-01 dates; currently passing, but it is the same class of bug).
**Warning signs:** `Tests: 4 failed, 159 passed`.

### Pitfall 3: `JWT_SECRET` containing a "weak" word
**What goes wrong:** The existing check is a substring match (`secret`, `default`, `change-this`, `jwt-secret`). My first CI-style value (`aVeryLongRandomTestSecretValue...`) was rejected and every test suite failed at import. **How to avoid:** generate with `openssl rand -hex 32`; in CI generate per run (`echo "JWT_SECRET=$(openssl rand -hex 32)" >> "$GITHUB_ENV"`).

### Pitfall 4: Target port / `PORT` mismatch -> 502
**What goes wrong:** Railway injects `PORT` at runtime and probes that port [CITED: docs.railway.com/guides/healthchecks]; for Railway-provided domains, a single listening port is auto-detected as the target port [CITED: docs.railway.com/networking/domains/working-with-domains]. A leftover `ENV PORT=10000` or a hand-set `PORT` can disagree with the domain's target port.
**How to avoid:** Remove `ENV PORT`/`EXPOSE 10000`; generate the domain AFTER the first successful deploy; verify with `railway domain list --service kitcha-api --json`; if wrong, `railway domain update <domain> --port <port-from-logs>`.

### Pitfall 5: Client-IP hop count is not officially documented
**What goes wrong:** Railway documents `X-Real-IP` (client remote IP) and `X-Forwarded-Proto: https` [CITED: docs.railway.com/networking/public-networking/specs-and-limits] but not XFF hop count; community threads conflict. `trust proxy 1` is correct *if* Railway appends the client IP as the last XFF entry and there is exactly one proxy.
**How to avoid:** Post-deploy check (non-destructive): call `/api/v1` twice with different spoofed leftmost XFF values and confirm `ratelimit-remaining` decrements (same bucket). This was reproduced locally against `trust proxy 1`. If the bucket changes per request, trust proxy is too permissive; if all users share one bucket, hop count is too high/low. MEDIUM confidence until verified in production.

### Pitfall 6: Workspace-wide spend limit
**What goes wrong:** `railway usage limit set --target workspace --hard N` applies to the whole workspace; when hit, "all your workloads will be taken offline" [CITED: docs.railway.com/reference/usage-limits], which includes nurse-quest, medichain, etc. Minimum hard limit is $10. Current workspace usage is $0.19 (nurse-quest $0.18).
**How to avoid:** Human checkpoint: user chooses soft/hard values knowing they cover all four existing projects. Suggested starting point: soft $8, hard $20 (STACK.md estimates $7-15/mo for API+Postgres; third-party number, LOW-MEDIUM).

### Pitfall 7: Disallowed Origin handled via `callback(new Error())`
Currently surfaces as 500 through `errorHandler`. Replace with the 403 guard (Pattern 2). Also: `FRONTEND_URL` is currently warning-only; union it into the allowlist.

### Pitfall 8: Prisma CLI as non-root in Alpine runner
`USER nodejs` is created with `adduser --system` (no guaranteed writable home). `migrate deploy` should not need to write outside the project, but Prisma may try update-check/telemetry (the update banner appeared in local output). Set `ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1` in the runner stage. If the first deploy shows EACCES, `chown -R nodejs:nodejs /app/node_modules/.prisma /app/node_modules/@prisma` in the Dockerfile. Not reproducible locally (Docker daemon not running); Railway build logs are the test. LOW-MEDIUM.

### Pitfall 9: Authentication limiter will lock your own smoke test
`authLimiter` is 5 failed attempts / 15 min / IP (successes are skipped). Do not put a "6 wrong passwords -> 429" check in the smoke script before the happy path; use the `ratelimit-remaining` technique instead.

## Code Examples

### Backend `.eslintrc.cjs` (verified: 0 errors / 157 warnings, exit 0)
```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2021: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-var-requires': 'off', // app.ts intentionally uses require() for route modules
    '@typescript-eslint/ban-types': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
```
Also in `backend/package.json`: `"lint": "eslint \"src/**/*.ts\""`, add `"type-check": "tsc --noEmit"`, and set `"prisma": "5.22.0"`, `"@prisma/client": "5.22.0"` (currently `^5.7.1`).

### Frontend `eslint.config.mjs` (verified: 0 errors / 146 warnings after the 16.4.0 upgrade, exit 0)
```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "warn",
      "@next/next/no-location-assign-relative-destination": "warn",
  } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

### Frontend build guard (verified: fails without var, passes with; value is inlined into `.next/static`)
```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.NEXT_PUBLIC_API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL must be set for production builds (e.g. https://<service>.up.railway.app)");
  }
  return {};
}
```
```typescript
// frontend/lib/constants/api-routes.ts  (keep the literal process.env.NEXT_PUBLIC_API_URL reference so Next can inline it)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
```
Using the phase hook (not `NODE_ENV`) means `next dev` and local `next start` are unaffected. Because Vercel Preview builds also run `next build`, the variable must be set for **Preview** as well as Production.

### app.ts ordering
```typescript
const app = express();
app.set("trust proxy", 1);                       // must precede rate limiters
app.get("/health", (_req, res) => res.status(200).json({ status: "ok", uptime: process.uptime() })); // before redirect/helmet/cors/limiter
if (config.env === "production") {
  app.use((req, res, next) => (req.secure ? next() : res.redirect(301, `https://${req.header("host")}${req.originalUrl}`)));
}
app.use(originGuard(isAllowed));
app.use(helmet(/* unchanged */));
app.use(cors({ origin: (o, cb) => cb(null, !o || isAllowed(o)), credentials: true, optionsSuccessStatus: 200, maxAge: 86400 }));
// ...limiter, parsers, morgan, routes, errors as today; delete the later duplicate /health
```
(`req.secure` is true when trust proxy is set and `X-Forwarded-Proto: https`.) `/health` also leaves out `environment` if you prefer to leak nothing.

### Seed guard (top of `backend/prisma/seed.ts`, before `new PrismaClient()`)
```typescript
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production. The seed creates a demo user with a known password.');
  process.exit(1);
}
```
The Dockerfile already sets `ENV NODE_ENV=production`, so the guard protects any `railway run`/`railway ssh` seed attempt.

### Dockerfile edits (runner stage)
Remove `EXPOSE 10000` and `ENV PORT=10000`; add `ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1`. Everything else (node:22-alpine, openssl, libc6-compat, `binaryTargets = ["native","linux-musl-openssl-3.0.x"]`) is already right for Prisma 5.22 on Alpine. `docker-compose.yml` sets its own `PORT=10000` and a `command:` override that uses `npx`; update the override to `/usr/local/bin/entrypoint.sh` for parity (local-only).

### GitHub Actions `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push:
  pull_request:
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: kitcha_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      NODE_ENV: test
      PORT: "3001"
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/kitcha_test?schema=public
      CORS_ORIGIN: http://localhost:3000
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: echo "JWT_SECRET=$(openssl rand -hex 32)" >> "$GITHUB_ENV"
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --ci

  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    env:
      NEXT_PUBLIC_API_URL: https://api.example.com   # CI-only placeholder so the production build guard passes
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build

  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: docker build -t kitcha-api ./backend
```
The frontend has no test framework or test files; for DEP-09 its "tests" are lint + `tsc` + `next build`. Do not add Vitest/Jest in this phase (flagged in Open Questions). Node 22 matches the Dockerfile; local machine runs Node 24 and everything passed there too. `npm ci` triggers `postinstall: prisma generate` (needs `prisma/schema.prisma`, present).

### Production smoke test (outline for `scripts/smoke-prod.sh`)
Inputs: `API=https://<service>.up.railway.app`, `FE=https://kitcha-ai.vercel.app`. All checks use `curl -sS -o /dev/null -w '%{http_code}'`:
1. `GET $API/health` -> 200; `GET http://<host>/health` (plain HTTP) must not 301 (or, if the edge itself redirects HTTP->HTTPS, record it, the container check is the HTTPS one).
2. Preflight: `curl -X OPTIONS $API/api/v1/auth/login -H "Origin: $FE" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"` -> 200 and `access-control-allow-origin: $FE`.
3. Disallowed origin: `-H "Origin: https://evil.example"` on `GET $API/api/v1` -> 403 JSON (not 500).
4. Rate-limit identity: two `GET $API/api/v1` with `X-Forwarded-For: 1.1.1.1, 9.9.9.9` and `2.2.2.2, 9.9.9.9`; assert `ratelimit-remaining` of the second is lower than the first.
5. `POST /api/v1/auth/signup` with a unique `smoke+$(date +%s)@example.com` and a compliant password -> token; `POST /auth/login` -> token.
6. Pantry CRUD with `Authorization: Bearer`: POST `{ingredientName, quantity, unit:"pieces", category:"other"}` -> 201 (id); GET `/pantry/:id` -> 200; PATCH -> 200; DELETE -> 200; GET -> 404.
7. Bundle check (proves the Vercel build inlined the Railway URL): fetch `$FE`, extract `_next/static/**/*.js` URLs from the HTML, `grep -l "<railway-host>"` -> at least one hit and `grep -c "localhost:3001"` -> 0.
8. (Manual, 2 minutes) In a real browser at `$FE`: register, log in, add/edit/delete a pantry item; DevTools Network shows requests to the Railway host with 200s and no CORS errors.
Delete the smoke user afterwards if an account-delete endpoint exists; otherwise leave it (empty DB, harmless) and note it.

## Railway Runbook (verified against local `railway` 5.45.10 `--help`; run from `backend/`)

Workspace plan is already `HOBBY` [VERIFIED: `railway api 'query { me { workspaces { name plan } } }'`]. Workspace: "Erven Idjad's Projects". Never run `railway link` to, or `up` against, the other four projects; always pass `--service`/`--project` explicitly or confirm `railway status` shows `kitcha` first.

| Step | Command | Status |
|------|---------|--------|
| 0. Preconditions | `railway whoami`; `railway list` (confirm no existing `kitcha`) | [VERIFIED: run] |
| 1. Create project | `cd backend && railway init --name kitcha --workspace "Erven Idjad's Projects" --json` (links the directory) | [VERIFIED: help] |
| 2. Add Postgres | `railway add --database postgres --json` (service is named `Postgres`) | [VERIFIED: help; service name is standard template behaviour, confirm with `railway service list --json`] |
| 3. Add API service | `railway add --service kitcha-api --json` | [VERIFIED: help] |
| 4. Region (Singapore) | `railway service scale --service kitcha-api asia-southeast1-eqsg3a=1` and the same for `Postgres` | Region id [VERIFIED: GraphQL `regions` query + docs.railway.com/reference/regions]. Applying `scale` to a DB service with a volume is [ASSUMED]; alternative: set preferred region in Account Settings before step 2. DB is empty so recreating is cheap. Verify with `railway environment config --json` |
| 5. Variables | see block below | `variable set` syntax [VERIFIED: help]; reference syntax [CITED: docs.railway.com/guides/variables] |
| 6. Healthcheck path | `railway environment edit --service-config kitcha-api deploy.healthcheckPath /health --message "healthcheck"` | Config key `deploy.healthcheckPath` [CITED: config-as-code docs]; `environment edit` dot-path form [VERIFIED: help example uses `deploy.startCommand`]. Fallback: GraphQL `serviceInstanceUpdate(serviceId, environmentId, input:{healthcheckPath:"/health"})` (field exists in `ServiceInstanceUpdateInput` [VERIFIED: `railway api describe`]) or dashboard Settings |
| 7. Deploy | `railway up --service kitcha-api --detach --message "phase 1 first deploy"` (uploads `backend/`; `Dockerfile` auto-detected at upload root [CITED: docs.railway.com/builds/dockerfiles]) | [VERIFIED: help] |
| 8. Watch | `railway deployment list --service kitcha-api --json`; `railway logs --service kitcha-api --build --lines 200`; `railway logs --service kitcha-api --deployment --lines 200` | [VERIFIED: help]. `up --detach` does not wait for health |
| 9. Domain | after the first healthy deploy: `railway domain --service kitcha-api --json`; verify `railway domain list --service kitcha-api --json` target port equals the port in the startup log | [VERIFIED: help] |
| 10. CORS vars | `railway variable set --service kitcha-api CORS_ORIGIN=https://kitcha-ai.vercel.app FRONTEND_URL=https://kitcha-ai.vercel.app` (triggers redeploy) | |
| 11. Spend cap | `railway usage limit set --target workspace --soft <N> --hard <M>` then `railway usage limit status --json` | [VERIFIED: help + CITED: docs.railway.com/reference/usage-limits]. Human decides N, M (min hard $10) |
| 12. Single replica | `railway service scale --service kitcha-api asia-southeast1-eqsg3a=1` already pins 1; confirm in `railway environment config --json` | |

```bash
# Step 5 (single-quote the reference so the shell does not expand it)
railway variable set --service kitcha-api --skip-deploys \
  NODE_ENV=production API_VERSION=v1 LOG_LEVEL=info JWT_EXPIRES_IN=7d \
  CORS_ORIGIN=https://kitcha-ai.vercel.app FRONTEND_URL=https://kitcha-ai.vercel.app \
  VERCEL_PREVIEW_SCOPE=ervenderrs-projects \
  'DATABASE_URL=${{Postgres.DATABASE_URL}}'
openssl rand -hex 32 | railway variable set JWT_SECRET --stdin --service kitcha-api --skip-deploys
# Do NOT set PORT.
```
Notes: `variable set` triggers a deploy unless `--skip-deploys`; batching with `--skip-deploys` before the first `up` avoids a failed deploy with half the variables. `${{Postgres.DATABASE_URL}}` is the private-network URL; `DATABASE_PUBLIC_URL` exists only with the TCP proxy (do not enable). Because the reference string is stored literally, verify with `railway variable list --service kitcha-api --kv` (prints raw values, do not paste output anywhere). Subsequent backend deploys are manual `railway up` (no GitHub link); say so in the README.

Healthcheck facts [CITED: docs.railway.com/guides/healthchecks]: path must return 2xx (a 301 fails), default timeout 300s (`RAILWAY_HEALTHCHECK_TIMEOUT_SEC` to change), probes come from host `healthcheck.railway.app` (the app does no host filtering, fine), checked only at deploy start. Migrations run before `listen`, so keep the default 300s.

Railway CLI could not be fully dry-run (no mutating commands were executed during research): steps 2, 4, 6, 9 should be confirmed on first execution; each has a stated fallback.

## Vercel Steps (CLI is not installed and not logged in)

`which vercel` -> not found; `vercel` 62.7.0 is on npm. Default plan = dashboard (zero tooling):
1. Vercel dashboard -> project `kitcha` -> Settings -> Environment Variables -> add `NEXT_PUBLIC_API_URL` = `https://<railway-domain>` (no trailing slash) for **Production** and **Preview** (preview needs "all branches"). Also confirm Root Directory = `frontend`.
2. Trigger a rebuild: push the next commit (project is Git-connected), or Deployments -> latest -> Redeploy.
3. Confirm with the smoke-test bundle check.

CLI alternative (only if the user accepts an interactive login checkpoint): `npx vercel@62.7.0 login`, `cd frontend && npx vercel@62.7.0 link`, `vercel env add NEXT_PUBLIC_API_URL production --value "https://<host>" --no-sensitive --yes` and the same for `preview`, then `vercel redeploy <deployment-url> --target=production` [CITED: vercel.com/docs/cli/env, /cli/redeploy]. `NEXT_PUBLIC_` variables are stored as Config type automatically.

## Next.js 16.0.2 -> 16.4.0 Upgrade Notes

Executed in a scratch copy (`npm ci`, then `npm install --save-exact next@16.4.0 eslint-config-next@16.4.0 react@19.3.0 react-dom@19.3.0`):
- `tsc --noEmit`: clean (before and after).
- `next build`: passes, Turbopack, 15 static routes (before and after).
- `package.json` diff: only the 5 pins. Lockfile is updated by npm; commit both.
- Lint: baseline 98 errors/28 warnings -> 112 errors/34 warnings; the delta comes from `eslint-plugin-react-hooks ^7.1.0` (new rules: `set-state-in-effect` 11, `immutability` 5, `incompatible-library` 3, `static-components` 3) and `@next/next/no-location-assign-relative-destination` (3). All become warnings per the config above.
- No code changes were required: the app has no `middleware.ts`, no parallel routes, no `next lint` usage, no `serverRuntimeConfig`, and `package.json` scripts already use plain `next build`. The 16.x guide's breaking changes (async request APIs, `middleware`->`proxy`, image defaults, removal of `next lint`) were already absorbed at 16.0 [CITED: nextjs.org/docs/app/guides/upgrading/version-16, v16.3.8 docs]. I found no separate 16.4 release notes (a web search returned nothing for 16.4); treat 16.4-specific changes as covered only by the successful build and lint run.
- `npm audit --omit=dev` still reports 4 transitive vulnerabilities (1 moderate, 3 high: e.g. `source-map-js`, `form-data`) fixable with `npm audit fix`; optional, not required by DEP-01. Do not run `--force`.
- Prettier check fails on 66 files today; CI does not run it (out of scope).
- Node: engines `>=20.9`; Vercel/GitHub Node 22 fine.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `railway.json`/`railway.toml` | CLI/dashboard settings or Infrastructure as Code (`.railway/railway.ts`) | Legacy files honoured until 2026-12-01 | Do not add config files; use `environment edit` |
| `npx prisma` in runtime image | Local `node_modules/.bin/prisma` | n/a | No network/cache dependence as non-root |
| `next lint` | ESLint CLI with flat config | Next 16.0 | Already in place (`eslint .`) |
| Spend cap "dashboard only" | `railway usage limit set` | CLI 5.x | Correct the CONTEXT assumption |

**Deprecated/outdated:** `render.yaml` (delete); `preDeployCommand` in that file; `Dockerfile ENV PORT=10000`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `railway service scale <region>=1` can place the Postgres service (with volume) in Singapore; otherwise preferred region in Account Settings | Runbook step 4 | Postgres in another region adds latency only; fix by recreating the empty DB |
| A2 | `railway add --database postgres` names the service `Postgres` so `${{Postgres.DATABASE_URL}}` resolves | Runbook step 2/5 | `DATABASE_URL` unresolved, container fails env validation; fix by checking `railway service list` and using the real name |
| A3 | Railway appends the real client IP as the last `X-Forwarded-For` entry with one proxy hop (so `trust proxy 1` is right) | Pitfall 5, DEP-04 | Rate limits shared by everyone (too low hop count) or spoofable (too high); smoke check detects it |
| A4 | Private-network DNS may lag at container start, justifying the migration retry loop | Pattern 3 | Harmless if untrue |
| A5 | Prisma CLI works as the non-root `nodejs` user in the Alpine runner without extra chown | Pitfall 8 | First deploy crash-loops with EACCES; fix with chown in Dockerfile |
| A6 | Railway Postgres major version is close to 16 (CI uses `postgres:16-alpine`) | CI | Minor; Prisma 5.22 supports 12-16/17 |
| A7 | Suggested caps soft $8 / hard $20; realistic cost $7-15/mo | Pitfall 6 | Hard limit too low takes ALL workspace workloads offline; user must choose |
| A8 | Vercel Root Directory is already `frontend` and Production env var is currently unset/wrong | Vercel steps | Dashboard check resolves it |
| A9 | `environment edit --service-config <svc> deploy.healthcheckPath <path>` works as written | Runbook step 6 | Use GraphQL `serviceInstanceUpdate` or dashboard fallback |

## Open Questions

1. **Spend-cap values**
   - Known: CLI can set it; workspace-wide; min hard $10; Hobby includes $5 usage.
   - Unclear: user's tolerance; whether capping the shared workspace is acceptable given 4 other projects.
   - Recommendation: human checkpoint with proposed soft $8 / hard $20; planner runs `railway usage limit set` after the user confirms numbers (CONTEXT said dashboard-only; the CLI route is strictly easier).
2. **Existing `NEXT_PUBLIC_API_URL` in Vercel and Root Directory**
   - Unclear without Vercel access. Recommendation: first task of the Vercel checkpoint is "report current value and root directory".
3. **Frontend "tests" for DEP-09**
   - No test framework or files exist in `frontend/`. Recommendation: accept lint + type-check + production build as the frontend gate; defer a test runner.
4. **Region move for Postgres** (A1): decide at execution; acceptable to skip Singapore for the DB if it is awkward (CONTEXT says "if available").
5. **Custom domain later** would be a new CORS origin; out of scope, but `CORS_ORIGIN` is comma-separated for that reason.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | yes | v24.9.0 (CI/Docker use 22) | - |
| npm | build/test | yes | 11.6.0 | - |
| Railway CLI | DEP-02/03/06 | yes, logged in | 5.45.10 | none needed; no upgrade required |
| Railway account plan | DEP-02 | yes, workspace `HOBBY` | - | - |
| gh CLI | repo / CI inspection | yes, logged in as ervenderr | - | - |
| Vercel CLI | DEP-07 | **no** (not installed, not logged in) | 62.7.0 on npm | Dashboard steps (default) |
| Docker daemon | local image build | CLI present (29.7.2) but daemon not running | - | `docker-build` CI job; Railway build logs |
| PostgreSQL (local) | backend tests | Homebrew `postgresql@14`/`@16` installed, not running | 16.15 binaries | Start a temp cluster: `initdb -D <dir> -U postgres --auth=trust`, `pg_ctl -D <dir> -o "-p 5544 -c unix_socket_directories=''" start` (used during this research) or use CI |
| openssl | secret generation | yes (macOS/ubuntu) | - | - |
| psql | optional DB inspection | yes | 14.19 | - |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Vercel CLI (dashboard), Docker daemon (CI image build).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + ts-jest + supertest 6 (backend); none in frontend |
| Config file | `backend/jest.config.js` (roots `tests/`, setup `tests/setup.ts`, `forceExit`, `resetMocks`) |
| Quick run command | `cd backend && npx jest tests/<file>.test.ts --coverage=false` |
| Full suite command | `cd backend && npm test` (needs `DATABASE_URL`, `JWT_SECRET`, `PORT`; run `npx prisma migrate deploy` first) |
| Baseline | 163 tests: 159 pass, 4 fail (pantry time bomb) - must be 163/163 after the fix [VERIFIED locally against Postgres 16.15] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-01 | next 16.4.0, react 19.3.0 pinned; builds | build | `cd frontend && npm ls next react react-dom eslint-config-next --depth=0 && NEXT_PUBLIC_API_URL=https://x.example npx next build` | n/a (config) |
| DEP-01 | type-check | static | `cd frontend && npm run type-check` | yes |
| DEP-02 | Project/services/domain exist, cap set | cli | `railway status --json` (project `kitcha`, services `kitcha-api`,`Postgres`); `railway usage limit status --json` shows hard limit | script |
| DEP-02 | API live | smoke | `curl -fsS https://$API/api/v1` | `scripts/smoke-prod.sh` (Wave 0) |
| DEP-03 | `/health` 200, DB-free, no redirect (prod mode) | integration | `cd backend && npx jest tests/health.test.ts` (sets `NODE_ENV=production`, no `x-forwarded-proto`, expects 200; does not require DB reachability) + `curl -fsS https://$API/health` | Wave 0 |
| DEP-03 | Railway marks deploy healthy | cli | `railway deployment list --service kitcha-api --json` latest status `SUCCESS` | - |
| DEP-04 | `trust proxy` = 1; buckets keyed by rightmost XFF | unit/integration | `npx jest tests/trust-proxy.test.ts` (`app.get('trust proxy') === 1`; two requests with different spoofed leftmost XFF share `ratelimit-remaining` decrement; different rightmost values do not) + smoke step 4 | Wave 0 |
| DEP-05 | Zod env: missing/invalid vars fail with readable message; origins normalized; prod forbids `*`/localhost | unit | `npx jest tests/env.schema.test.ts` | Wave 0 |
| DEP-05 | CORS: exact allow, trailing slash normalized, preview regex matches `kitcha-94293z3ib-ervenderrs-projects.vercel.app` and `kitcha-git-x-ervenderrs-projects.vercel.app`, rejects `kitcha-evil.vercel.app`/other scope; disallowed -> 403 JSON; preflight 200 | unit/integration | `npx jest tests/cors.test.ts` + smoke steps 2-3 | Wave 0 |
| DEP-06 | Entrypoint uses local bin and `exec` | static | `grep -q 'exec node dist/index.js' backend/entrypoint.sh && ! grep -q npx backend/entrypoint.sh && ! grep -q 'npm start' backend/entrypoint.sh` | - |
| DEP-06 | Migrations applied on deploy; clean shutdown | log | `railway logs --service kitcha-api --deployment --lines 300 \| grep -E "migrations? (have been )?applied\|No pending migrations"`; `railway redeploy` then logs show `SIGTERM received. Starting graceful shutdown` | - |
| DEP-07 | Build fails without var | build | `cd frontend && ! (env -u NEXT_PUBLIC_API_URL npx next build)` (expects non-zero and message) | - |
| DEP-07 | Deployed frontend hits Railway; CRUD works | smoke + manual | `scripts/smoke-prod.sh` steps 5-7; manual browser pass step 8 (manual-only: real browser CORS/localStorage flow) | Wave 0 |
| DEP-08 | Seed refuses production | unit | `cd backend && NODE_ENV=production npx ts-node prisma/seed.ts; test $? -eq 1` | - |
| DEP-08 | `render.yaml` gone; env examples complete | static | `test ! -e backend/render.yaml && test -f frontend/.env.example && for v in DATABASE_URL JWT_SECRET JWT_EXPIRES_IN CORS_ORIGIN FRONTEND_URL VERCEL_PREVIEW_SCOPE LOG_LEVEL API_VERSION NODE_ENV PORT; do grep -q "^#\? \?$v" backend/.env.example \|\| echo MISSING $v; done` | - |
| DEP-09 | CI green on push | ci | `gh run list --workflow ci.yml --limit 1 --json conclusion,status`; local equivalents: `cd backend && npm run lint && npm run type-check && npm test`; `cd frontend && npm run lint && npm run type-check && npm run build` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant `npx jest tests/<file>` or `npm run type-check`
- **Per wave merge:** full backend `npm test` (with Postgres) + frontend `npm run lint && npm run type-check && npm run build`
- **Phase gate:** CI green on `main`, `scripts/smoke-prod.sh` all pass, manual browser pass done, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/env.schema.test.ts` - DEP-05
- [ ] `backend/tests/cors.test.ts` - DEP-05 (use a tiny express app with only `originGuard` + `cors`; no DB needed)
- [ ] `backend/tests/health.test.ts` - DEP-03 (use `jest.resetModules()` + set `process.env.NODE_ENV='production'` before `require('../src/app')`; a valid `PORT` and `CORS_ORIGIN` must be set because production validation now requires them)
- [ ] `backend/tests/trust-proxy.test.ts` - DEP-04
- [ ] Fix `backend/tests/pantry.test.ts` fixed dates -> relative dates (DEP-09 prerequisite)
- [ ] `backend/.eslintrc.cjs`, `type-check` script, quoted lint glob (DEP-09)
- [ ] `scripts/smoke-prod.sh` (DEP-02/07)
- [ ] `.github/workflows/ci.yml` (DEP-09)
- [ ] Local Postgres for tests (temp cluster command above) - no framework install needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (unchanged code) | existing bcryptjs + JWT; JWT_SECRET >= 32 chars and not weak, enforced by Zod at startup |
| V3 Session Management | yes | Bearer JWT in localStorage (no cookies); expiry via `JWT_EXPIRES_IN`; do not add cookie auth |
| V4 Access Control | yes | existing `authenticate` middleware; CORS origin allowlist + 403 guard |
| V5 Input Validation | yes | Zod for env/config; existing express-validator for requests |
| V6 Cryptography | yes | `openssl rand -hex 32` for JWT_SECRET; never hand-rolled; secrets only in Railway variables |
| V14 Configuration | yes | no secrets in repo (repo is **public**); `.env.example` has placeholders only; fail-fast env; seed blocked in prod; no `CORS_ORIGIN=*` |

### Known Threat Patterns for Express + Railway + Vercel

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed `X-Forwarded-For` to dodge rate limits | Spoofing / DoS | `trust proxy 1` (rightmost entry); never `true`; smoke check |
| Over-broad CORS (`*`, substring match on `.vercel.app`) | Info disclosure / Tampering | exact allowlist + anchored regex including owner scope slug `ervenderrs-projects` |
| Credential brute force | Spoofing | existing `authLimiter` (5/15 min) now keyed by real IP; account lockout fields exist |
| Default/demo credentials in prod | Elevation | seed refuses `NODE_ENV=production` |
| Secrets in a public repo / logs | Info disclosure | Railway variables only; Zod errors print paths not values; do not paste `railway variable list --kv` output |
| Exposed database | Info disclosure | private `${{Postgres.DATABASE_URL}}`; no TCP proxy |
| Vulnerable framework (React2Shell RCE class) | Tampering / EoP | Next 16.4.0 / React 19.3.0 upgrade (DEP-01) |
| Unclean shutdown corrupting in-flight work | DoS | `exec node` so SIGTERM reaches the app's graceful shutdown handler |

## Sources

### Primary (HIGH confidence)
- Local execution (2026-10-08): `railway --help` and subcommands (v5.45.10), `railway api` GraphQL schema/regions/workspace plan, `railway usage limit status`; scratch-copy frontend upgrade (`npm ci`, install, `tsc`, `eslint`, `next build`); scratch-copy backend (`npm ci`, `tsc`, `eslint`, full Jest run against a temp Postgres 16.15); express-rate-limit/`trust proxy` behaviour test; Zod 4.6.5 schema test; `next.config.ts` guard test
- Repo files: `backend/src/app.ts`, `index.ts`, `config/env.config.ts`, `Dockerfile`, `entrypoint.sh`, `render.yaml`, `package.json`, `jest.config.js`, `tests/*`, `prisma/seed.ts`; `frontend/package.json`, `next.config.ts`, `eslint.config.mjs`, `lib/constants/api-routes.ts`
- GitHub API for `ervenderr/Smart-Grocery-Meal-Planner`: deployments by `vercel[bot]`, status URL `https://kitcha-94293z3ib-ervenderrs-projects.vercel.app`; repo visibility PUBLIC; latest `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0
- npm registry: next 16.4.0 (+peer deps/engines), eslint-config-next 16.4.0, react/react-dom 19.3.0, zod 4.6.5, vercel 62.7.0, prisma 5.22.0 line
- docs.railway.com: /guides/healthchecks, /guides/variables, /reference/usage-limits, /reference/config-as-code, /reference/regions, /builds/dockerfiles, /networking/domains/working-with-domains, /networking/public-networking/specs-and-limits, /networking/private-networking/how-it-works
- nextjs.org/docs/app/guides/upgrading/version-16 (v16.3.8 docs, updated 2026-08-25)
- vercel.com/docs/deployments/generated-urls, /docs/cli/env, /docs/cli/redeploy

### Secondary (MEDIUM confidence)
- Railway Help Station threads on client IP / X-Forwarded-For semantics (conflicting; used only to justify the verify-after-deploy step)

### Tertiary (LOW confidence)
- Third-party Railway cost estimate ($7-15/mo, from STACK.md); Next.js 16.4-specific release notes not found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions read from the registry and exercised locally
- Architecture / code changes: HIGH - each change prototyped or based on read code; the app-level CORS/health tests are specified but not yet written
- Railway CLI flow: MEDIUM-HIGH - syntax verified from `--help`/docs, no mutating command run; five steps carry explicit fallbacks
- Pitfalls: HIGH for CI/lint/test/Vercel-sequencing (reproduced), MEDIUM for Railway runtime behaviour (hop count, Prisma non-root)

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 for Railway/Vercel CLI behaviour (fast-moving); the Next/React pins are valid until a newer patch ships; legacy `railway.json` support ends 2026-12-01.
