---
phase: 6
slug: capture-loops
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Concrete cases per requirement live in `06-RESEARCH.md` under "Validation Architecture" and in each plan's `<behavior>` blocks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest + supertest (backend, throwaway Postgres 16 "TESTENV"); Vitest 5 `environment: 'node'`, `lib/**/*.test.ts` only (frontend pure helpers); lint/type-check/next build |
| **Config file** | `backend/jest.config.js`, `frontend/vitest.config.ts` (both exist; no installs needed) |
| **Quick run command** | `cd backend && npx jest tests/<touched>.test.ts --coverage=false && npx tsc --noEmit` ; `cd frontend && npx vitest run lib/<area> && npm run type-check` |
| **Full suite command** | `cd backend && npm run lint && npm test -- --ci && npm run build` ; `cd frontend && npm run lint && npm run type-check && npm test && NEXT_PUBLIC_API_URL=https://x.example npx next build` |
| **Estimated runtime** | ~240 seconds (full); quick runs < 60 seconds |

TESTENV ports: 06-01 5546, 06-03 5547, 06-04 5548 (parallel Wave 1); 06-06 5546, 06-08 5547, 06-12 5546 (each plan stops its cluster).

---

## Sampling Rate

- **After every task commit:** quick run for the touched side + `tsc --noEmit` / `npm run type-check`
- **After every plan wave:** full backend suite on TESTENV; frontend lint + type-check + vitest
- **Before `/gsd:verify-work`:** full suites green, `next build` green, migration drift check exit 0, backend deployed to Railway and smoke check 14 passing BEFORE the frontend push (06-12)
- **Max feedback latency:** 60 seconds per quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CAP-05 | T-06-01, T-06-02 | PATCH quantity bounded 0..99999; other user's item 404 | integration | `TESTENV: cd backend && npx jest tests/pantry-quick-edit.test.ts tests/pantry.test.ts --coverage=false` | ❌ W0 (created in task) | ⬜ pending |
| 06-01-02 | 01 | 1 | CAP-05 | T-06-03 | Optimistic update rolls back; immutable cache writes | unit (Vitest) | `cd frontend && npx vitest run lib/pantry && npm run type-check` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | CAP-05 | T-06-03 | 400 ms debounce, one PATCH per settle | static + type-check | `cd frontend && npm run type-check && npm run lint && npx vitest run` | n/a | ⬜ pending |
| 06-02-01 | 02 | 1 | CAP-01 | T-06-SC | Human legitimacy gate before install | manual checkpoint | `npm view barcode-detector@3.2.2 version` | n/a | ⬜ pending |
| 06-02-02 | 02 | 1 | CAP-01 | T-06-SC, T-06-04 | Exact pin; no lockfile entries removed | static | `cd frontend && grep -q '"barcode-detector": "3.2.2"' package.json && npm run type-check && npm test` | n/a | ⬜ pending |
| 06-03-01 | 03 | 1 | CAP-04 | T-06-08 | Decimal math, clamp to have, floor 0 | unit (Jest) | `cd backend && npx jest tests/cook-plan.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 1 | CAP-04 | T-06-07 | Hidden/deleted recipe 404 RECIPE_NOT_FOUND | integration | `TESTENV: cd backend && npx jest tests/cook-endpoints.test.ts -t preview --coverage=false` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 1 | CAP-04 | T-06-06, T-06-09, T-06-10 | userId-scoped lots, tx rollback, caps | integration | `TESTENV: cd backend && npx jest tests/cook-plan.test.ts tests/cook-endpoints.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 1 | CAP-03 | T-06-12 | Units coerced to PantryUnit; categories validated | unit (Jest) | `cd backend && npx jest tests/shopping-pantry.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 1 | CAP-03 | T-06-11, T-06-13, T-06-14 | Merge after commit; failure logged, finish kept | integration | `TESTENV: cd backend && npx jest tests/shopping-finish-pantry.test.ts tests/shopping-finish.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 2 | CAP-05 | T-06-15 | Only YYYY-MM-DD produced | unit (Vitest) | `cd frontend && npx vitest run lib/pantry` | ✅ extend expiry.test.ts | ⬜ pending |
| 06-05-02 | 05 | 2 | CAP-05 | T-06-15 | Sheet keeps value on error | static + type-check | `cd frontend && npm run type-check && npm run lint && npx vitest run` | n/a | ⬜ pending |
| 06-06-01 | 06 | 2 | CAP-01, CAP-02 | T-06-18 | [BLOCKING] additive migration, no drift | migration | `TESTENV: cd backend && npx prisma migrate deploy && npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code` | ❌ W0 | ⬜ pending |
| 06-06-02 | 06 | 2 | CAP-01, CAP-02 | T-06-16, T-06-17 | Barcode regex; cross-user filter isolation | integration | `TESTENV: cd backend && npx jest tests/pantry-barcode.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-06-03 | 06 | 2 | CAP-01, CAP-02 | T-06-16 | Client-side 8-14 digit validation | static + type-check | `cd frontend && npm run type-check && npm run lint && npx vitest run` | n/a | ⬜ pending |
| 06-07-01 | 07 | 2 | CAP-03 | T-06-19 | n/a (copy + payload) | unit (Vitest) | `cd frontend && npx vitest run lib/shopping` | ❌ W0 | ⬜ pending |
| 06-07-02 | 07 | 2 | CAP-03 | T-06-19 | Accessible switch | static + type-check | `cd frontend && npm run type-check && npm run lint && npx vitest run` | n/a | ⬜ pending |
| 06-08-01 | 08 | 3 | CAP-04 | T-06-23 | [BLOCKING] additive migration, no drift | migration | `TESTENV: cd backend && npx prisma migrate deploy && npx prisma migrate diff ... --exit-code` | ❌ W0 | ⬜ pending |
| 06-08-02 | 08 | 3 | CAP-04 | T-06-22 | cookedAt survives meal edits | unit + integration | `TESTENV: cd backend && npx jest tests/mealplan-cooked.test.ts tests/mealplan.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-08-03 | 08 | 3 | CAP-04 | T-06-20, T-06-21 | Once-only guard; concurrent apply one winner; ownership | integration | `TESTENV: cd backend && npx jest tests/cook-mealplan.test.ts --coverage=false` | ❌ W0 | ⬜ pending |
| 06-09-01 | 09 | 3 | CAP-01, CAP-02 | T-06-26 | Normalize/validate before requests; error mapping | unit (Vitest) | `cd frontend && npx vitest run lib/scan` | ❌ W0 | ⬜ pending |
| 06-09-02 | 09 | 3 | CAP-02 | T-06-24, T-06-25 | Repeat-submit guard; no raw HTML | static + type-check | `cd frontend && npm run type-check && npm run lint` | n/a | ⬜ pending |
| 06-09-03 | 09 | 3 | CAP-01, CAP-02 | T-06-24 | Prefill via controlled inputs | static + type-check | `cd frontend && npm run type-check && npm run lint && npx vitest run` | n/a | ⬜ pending |
| 06-10-01 | 10 | 4 | CAP-04 | T-06-27 | Client clamps Use to Have | unit (Vitest) | `cd frontend && npx vitest run lib/cook` | ❌ W0 | ⬜ pending |
| 06-10-02 | 10 | 4 | CAP-04 | T-06-28 | Apply disabled while pending | static + type-check | `cd frontend && npm run type-check && npm run lint && npx vitest run` | n/a | ⬜ pending |
| 06-10-03 | 10 | 4 | CAP-04 | T-06-28 | Cooked badge non-interactive | build | `cd frontend && NEXT_PUBLIC_API_URL=https://x.example npx next build` | n/a | ⬜ pending |
| 06-11-01 | 11 | 4 | CAP-01, CAP-02 | T-06-29, T-06-30 | Camera errors mapped; only the hook imports barcode-detector | unit (Vitest) + static | `cd frontend && npx vitest run lib/scan && npm run type-check` | ❌ W0 | ⬜ pending |
| 06-11-02 | 11 | 4 | CAP-01, CAP-02 | T-06-29, T-06-31 | Tracks stopped on every exit; lazy chunk | build | `cd frontend && npm run lint && NEXT_PUBLIC_API_URL=https://x.example npx next build` | n/a | ⬜ pending |
| 06-12-01 | 12 | 5 | CAP-01..05 | T-06-33, T-06-36 | No TOKEN echo; manifest/migration diff gates | smoke (syntax) + full suites | `bash -n scripts/smoke-prod.sh && (cd frontend && npm run lint && npm run type-check && npm test)` | ✅ extend smoke-prod.sh | ⬜ pending |
| 06-12-02 | 12 | 5 | CAP-01..05 | T-06-32, T-06-34 | Railway target check; migrations in logs | smoke (live) | `API=https://kitcha-api-production.up.railway.app scripts/smoke-prod.sh --api-only` | ✅ | ⬜ pending |
| 06-12-03 | 12 | 5 | CAP-01..05 | T-06-35 | Push only after backend live | CI | `gh run list --branch main --limit 1 --json conclusion -q '.[0].conclusion'` | ✅ | ⬜ pending |
| 06-13-01 | 13 | 6 | CAP-01..05 | T-06-38 | Camera frames stay on device | manual (device) | `curl -fsS https://kitcha-api-production.up.railway.app/health` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files are created test-first inside the owning tasks (RED commit before GREEN):

- [ ] `backend/tests/pantry-quick-edit.test.ts` (06-01) — CAP-05 PATCH 0 / negative / max / expiry null
- [ ] `backend/tests/cook-plan.test.ts`, `backend/tests/cook-endpoints.test.ts` (06-03) — CAP-04
- [ ] `backend/tests/shopping-pantry.test.ts`, `backend/tests/shopping-finish-pantry.test.ts` (06-04) — CAP-03
- [ ] `backend/tests/pantry-barcode.test.ts` (06-06) — CAP-01/02
- [ ] `backend/tests/mealplan-cooked.test.ts`, `backend/tests/cook-mealplan.test.ts` (06-08) — CAP-04
- [ ] `frontend/lib/pantry/quantity.test.ts` (06-01); extend `frontend/lib/pantry/expiry.test.ts` (06-05)
- [ ] `frontend/lib/shopping/finish-toast.test.ts` (06-07)
- [ ] `frontend/lib/scan/barcode.test.ts`, `prefill.test.ts`, `resolve-barcode.test.ts` (06-09); `frontend/lib/scan/camera.test.ts` (06-11)
- [ ] `frontend/lib/cook/preview.test.ts` (06-10)
- [ ] `scripts/smoke-prod.sh` check 14 (06-12)
- [ ] TESTENV Postgres started per plan (not running by default)

No framework installs needed. Coverage target 80% on new backend modules (`src/modules/cook`, `shopping-pantry*`, `mealplan.cooked.ts`) and pure frontend helpers.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera scan prefills the Add form; camera indicator turns off after scan | CAP-01 | Needs a real camera; iOS uses the ZXing-WASM ponyfill (RESEARCH A3/A4) | 06-13 steps 1-2 on iPhone (tab + home-screen) and Android |
| Permission denied / unknown product reach manual entry with barcode kept | CAP-02 | Browser permission UI is device-specific | 06-13 steps 3-4 |
| Bought it, Cooked it, stepper and expiry sheet by touch | CAP-03, CAP-04, CAP-05 | Touch ergonomics, safe areas | 06-13 steps 5-8 |
| UI-SPEC visual contract (44px targets, typography, 375x667 fit) | CAP-01..05 | Visual | 06-13 step 8; UI-SPEC Verification Checklist |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for quick runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
