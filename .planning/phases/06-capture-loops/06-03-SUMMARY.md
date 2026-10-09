---
phase: 06-capture-loops
plan: 03
subsystem: backend-cook
tags: [cook, pantry, fefo, decimal, express]
requires: []
provides:
  - POST /api/v1/cook/preview
  - POST /api/v1/cook/apply
  - cook.plan pure core (computeCookPlan, allocateDeduction, cookKey)
affects: [06-08, 06-10]
key-files:
  created:
    - backend/src/modules/cook/cook.plan.ts
    - backend/src/modules/cook/cook.constants.ts
    - backend/src/modules/cook/cook.service.ts
    - backend/src/modules/cook/cook.controller.ts
    - backend/src/modules/cook/cook.routes.ts
    - backend/src/modules/cook/cook.validation.ts
    - backend/src/types/cook.types.ts
    - backend/tests/cook-plan.test.ts
    - backend/tests/cook-endpoints.test.ts
  modified:
    - backend/src/app.ts
decisions:
  - "Group family key derived from aggregateGroups group.key (split on NUL) so cook keys match lot keys exactly"
  - "Typed CookUnitMismatchError thrown in the pure core, mapped to 400 DEDUCTION_UNIT_MISMATCH in the service (rolls back the tx)"
metrics:
  tasks: 3
  tests: 45 (23 pure, 22 endpoint)
  coverage: "src/modules/cook 98.42% stmts / 99.4% lines"
completed: 2026-10-09
---

# Phase 6 Plan 03: Cook preview and apply API Summary

Recipe "Cooked it" API: a pure Decimal planner (servings scaling, same-family conversion, mismatch/short/not-in-pantry/staple handling, FEFO lot allocation) behind `POST /cook/preview` and a transactional, userId-scoped `POST /cook/apply` that floors at 0 and never deletes.

## Commits
- 9f1e5ae test: failing cook plan tests (RED)
- c31e799 feat: pure cook plan and FEFO allocation (GREEN)
- (next) refactor: cookKey declared as function (to satisfy the contract grep)
- test: failing preview endpoint tests (RED)
- b6b00e9 feat: cook preview endpoint (service also contains apply)
- feat: cook apply endpoint tests

## Verification
- cook-plan + cook-endpoints: 45/45 pass on TESTENV (port 5547); full backend suite 57 suites / 1070 tests green; tsc clean; lint 0 errors.
- Coverage on src/modules/cook: 98.42% statements, 99.4% lines.

## Deviations from Plan
- **Task 3 RED not observed separately.** applyCook was written together with previewCook in the Task 2 commit (same service/controller/routes files; the plan registers the apply route in Task 2). The apply tests were added afterwards and passed on first run, so the Task 3 commit is tests only. Behavior coverage matches the plan list.
- cookKey was first committed as an arrow const, changed to a function declaration in a follow-up refactor commit to match the exports contract.
- Transient `tsc` error from a sibling plan's untracked file (shopping-pantry.ts) was seen mid-run and was out of scope; tsc was clean at the end.

## Known Stubs
None. 06-08 extension point (optional mealPlanItemId branch) is marked by a comment in applyCook.

## Self-Check: PASSED
