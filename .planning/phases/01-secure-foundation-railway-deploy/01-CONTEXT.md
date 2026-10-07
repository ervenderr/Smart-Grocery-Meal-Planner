# Phase 1: Secure Foundation & Railway Deploy - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

A patched frontend (Next.js 16.4.0+) talks to a live, correctly configured Railway API (Hobby plan, Railway Postgres) so register, login and pantry CRUD work in production at https://kitcha-ai.vercel.app. Covers DEP-01..DEP-09. Phase also fixes the backend deploy blockers found in research (healthcheck vs HTTPS redirect, trust proxy, CORS allowlist, entrypoint, env validation, seed guard) and adds CI.

</domain>

<decisions>
## Implementation Decisions

### Hosting topology
- Frontend stays on Vercel, already deployed at https://kitcha-ai.vercel.app. Phase sets `NEXT_PUBLIC_API_URL` in Vercel (via Vercel CLI if available, otherwise exact manual steps for the user) and redeploys.
- Backend + Postgres go in a NEW Railway project named `kitcha`, created via the Railway CLI. Region: Singapore if available. User sets the spend cap in the Railway dashboard (cannot be set via CLI); the plan must include that as an explicit manual checkpoint.
- No Render data to migrate: fresh empty Railway Postgres, `prisma migrate deploy` only. `render.yaml` is deleted.

### Backend platform fixes
- `app.set('trust proxy', 1)`; `/health` registered before the HTTPS redirect, DB-free, never redirected.
- CORS: allowlist from env (`CORS_ORIGIN` comma-separated, normalized without trailing slash) that includes `https://kitcha-ai.vercel.app`, plus a pattern for Vercel preview URLs of this project; unknown origins get a 403/clean CORS rejection, not a 500.
- Env validated with Zod at startup, fail fast with a clear message; no hand-set `PORT` on Railway (use the injected one); remove `ENV PORT=10000` from the Dockerfile.
- Entrypoint runs the local prisma binary (not `npx`) then `exec node dist/index.js`. No `railway.toml`/`railway.json` (deprecated); healthcheck path configured through CLI/dashboard.
- Seed script refuses `NODE_ENV=production`. `.env.example` for backend and frontend documents every variable. Prisma pinned to an exact version matching the lockfile.
- Single replica only (in-process Zapier cron).

### Frontend
- Upgrade `next` and `eslint-config-next` to 16.4.0 and React/React-DOM to the latest compatible 19.x (exact pins updated); build must pass.
- Production build fails if `NEXT_PUBLIC_API_URL` is unset (remove localhost fallback for production builds only).

### CI & verification
- GitHub Actions: lint, type-check and tests for backend and frontend on every push/PR.
- End-to-end production smoke test after deploy: register, login, pantry create/read/update/delete against the Railway URL from the Vercel frontend.

### Claude's Discretion
Dockerfile/entrypoint details, CI workflow structure, Zod env schema layout, CORS preview-URL pattern, exact Railway variable references (verify `${{Postgres.DATABASE_URL}}` syntax with the CLI/docs first).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/config/env.config.ts` (env loading/validation to extend), `backend/Dockerfile` and `entrypoint.sh`, Jest config, Winston logger, `frontend/lib/constants/api-routes.ts` (API_BASE_URL).

### Established Patterns
- Bearer JWT in localStorage via Axios interceptor (no cookies), so cross-origin needs only CORS + `Authorization` header allowed.
- `app.ts` has HTTPS redirect (line ~41) and exact-match CORS (line ~80) that must change.

### Integration Points
- Railway service env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`, `NODE_ENV`, Gemini key later.
- Vercel project env: `NEXT_PUBLIC_API_URL`.

</code_context>

<specifics>
## Specific Ideas

User owns 4 unrelated Railway projects (nurse-quest, comfortable-grace, intuitive-surprise, medichain): never touch them. Railway CLI is v5.45.10 (newer available); only upgrade if needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
