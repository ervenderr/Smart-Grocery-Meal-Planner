---
phase: 7
slug: store-readiness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract. Source of truth: the Validation Architecture section of 07-RESEARCH.md.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend jest 29 + ts-jest + supertest (real Postgres); frontend vitest (lib/**/*.test.ts) |
| **Config file** | backend/jest.config.js, frontend/vitest.config.ts |
| **Quick run command** | `cd backend && npx jest <file> --coverage=false` ; `cd frontend && npx vitest run lib` |
| **Full suite command** | `cd backend && npm test` ; `cd frontend && npm test && npx tsc --noEmit && npm run lint && npx next build` |
| **Estimated runtime** | ~120 seconds |

## Sampling Rate

- **After every task commit:** quick run of the task's test file
- **After every plan wave:** full suites
- **Before verify-work:** full suites green, next build green
- **Max feedback latency:** 120 seconds

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | Status |
|-----|----------|-----------|-------------------|--------|
| STORE-01 | Hard delete incl. RESTRICT FK case, wrong password non-401, DMMF coverage | integration | `npx jest tests/account-deletion.test.ts` | pending |
| STORE-02 | AI consent gate 403, grant/withdraw, versioning | integration + unit | `npx jest tests/ai-consent.test.ts`; `npx vitest run lib/ai` | pending |
| STORE-03 | AI report store/validate/rate-limit | integration | `npx jest tests/ai-report.test.ts` | pending |
| STORE-04 | Public legal pages render | build + curl | `cd frontend && npx next build` | pending |
| STORE-05 | Reviewer seed idempotent and prod-guarded; docs exist | integration + file check | `npx jest tests/seed-reviewer.test.ts` | pending |

## Wave 0 Requirements

- [ ] Local Postgres 16 running, backend/.env from .env.example (not committed), `prisma migrate deploy`
- [ ] backend/tests/account-deletion.test.ts, ai-consent.test.ts, ai-report.test.ts, seed-reviewer.test.ts
- [ ] tests/helpers/ai-test-helpers.ts grants consent by default
- [ ] frontend/lib/ai/*.test.ts for consent helper

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consent sheet, delete flow, badge/report UI | STORE-01/02/03 | No component test infra (no new deps) | Run app locally, exercise flows |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] No 3 consecutive tasks without automated verify
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
