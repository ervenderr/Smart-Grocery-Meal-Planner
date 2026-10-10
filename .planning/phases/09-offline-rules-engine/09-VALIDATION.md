---
phase: 9
slug: offline-rules-engine
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5 (frontend, node env, `lib/**/*.test.ts`) plus jest (backend parity tests) |
| **Config file** | `frontend/vitest.config.ts`, `backend/jest.config.*` (both exist) |
| **Quick run command** | `cd frontend && npx vitest run lib/rules` |
| **Full suite command** | `cd frontend && npm test && npm run type-check && npm run lint && npm run build; cd ../backend && npx jest tests/rules-parity --coverage=false` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** full suite command
- **Before verify-work:** full suite green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Test Type | Automated Command | Status |
|------|------|-------------|-----------|-------------------|--------|
| 01 units/diet | 1 | OFF-08 | unit + parity | `cd frontend && npx vitest run lib/rules/units.test.ts lib/rules/diet.test.ts` + backend `rules-parity-units/diet` | pending |
| 02 substitution data | 1 | OFF-08 | unit (schema integrity) | `cd frontend && npx vitest run lib/rules/substitutions-data.test.ts` | pending |
| 03 rank | 2 | OFF-08 | unit | `npx vitest run lib/rules/rank.test.ts lib/rules/pantry-index.test.ts lib/rules/staples-default.test.ts` | pending |
| 04 substitutes | 2 | OFF-08 | unit | `npx vitest run lib/rules/format-amount.test.ts lib/rules/substitutions.test.ts` | pending |
| 05 parity/perf | 3 | OFF-08 | parity + perf + determinism | `npx vitest run lib/rules/parity.test.ts lib/rules/rank.bench.test.ts lib/rules/determinism.test.ts` | pending |
| 06 data/hook | 3 | OFF-08 | unit + typecheck | `npx vitest run lib/rules/cook-data.test.ts lib/rules/view-model.test.ts` | pending |
| 07 components | 4 | OFF-08 | typecheck + lint | `npm run type-check && npx eslint components/recipes/cook` | pending |
| 08 page | 5 | OFF-08 | build + manual | `npm test && npm run type-check && npm run build` | pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TDD plans 01-05 create their tests before implementation. `@vitest/coverage-v8` is not installed; coverage is approximated by testing every exported function.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page works with network off after one online load | OFF-08 | Needs browser DevTools offline | Plan 08 checkpoint. Cold-start offline is deferred to Phase 11. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-10
