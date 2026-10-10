---
phase: 09
fixed_at: 2026-10-10T00:00:00Z
review_path: .planning/phases/09-offline-rules-engine/09-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Source review:** .planning/phases/09-offline-rules-engine/09-REVIEW.md
**Scope:** Critical and Warning (Info findings out of scope)

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

Verification per fix: `npx vitest run lib/rules` (245 passing at end), `npm run type-check` (clean), `npm run lint` (0 errors, 118 pre-existing warnings). Backend parity jest was not run: no fixtures changed, and removing the restriction cap matches the server (which does not cap stored preferences).

## Fixed Issues

### CR-01: Dietary restrictions silently dropped
**Commit:** d815c82
**Files:** `frontend/lib/rules/diet.ts`, `diet.test.ts`, `cook-data.ts`, `cook-data.test.ts`, `frontend/lib/hooks/use-cook-from-pantry.ts`, `frontend/components/recipes/cook/filter-card.tsx`, `frontend/app/(app)/recipes/cook/page.tsx`
**Applied fix:** Removed the 20-restriction cap (every restriction is compiled; only per-item length is bounded). Added `derivePrefsState`; the page stays in loading while the first preferences fetch is in flight, so allergens are never briefly unfiltered. When preferences cannot be loaded (offline or errored with no cache) a visible alert in `FilterCard` states that diet filtering is off. Tests cover restriction 50 of 50 and a peanut allergy after 30 other entries, plus all prefs states. Logic fix: requires human verification.

### WR-01: Unguarded cast can crash the page
**Commit:** 3f3b097
**Files:** `frontend/lib/rules/cook-data.ts`, `cook-data.test.ts`, `frontend/lib/hooks/use-cook-from-pantry.ts`
**Applied fix:** New pure `indexById` skips null, primitive, array and id-less rows; the hook uses it for `recipesById`. Tested with corrupted rows.

### WR-02: "Ready to cook" for recipes with zero ingredients
**Commit:** e720b3e
**Files:** `frontend/lib/rules/view-model.ts`, `view-model.test.ts`
**Applied fix:** Pill now follows `readyToCook`; zero-ingredient recipes show "No ingredients listed" and "No ingredients to compare". Requires human verification (copy/logic).

### WR-03: "need 0" for ingredients without quantity
**Commit:** fe3bd8e
**Files:** `frontend/lib/rules/view-model.ts`, `view-model.test.ts`
**Applied fix:** `formatMatchLine` and `substituteContextLine` render "amount not specified" when `needed <= 0`. The substitution scaler already falls back to the unscaled line for quantity <= 0. Requires human verification.

### WR-04: Token-subset substitution matching
**Commit:** 97ea344
**Files:** `frontend/lib/rules/substitutions.ts`, `substitutions.test.ts`
**Applied fix:** The fallback now requires the key to end on the name's head noun (last token). "buttermilk powder", "butter chicken", "milk chocolate", "peanut oil" and "honey mustard" no longer match; "peanut butter", "coconut milk", "almond milk", "melted butter" and "whole milk" still do. One existing test input changed from "organic brown sugar cubes" to "organic brown sugar", since the cubes form is now deliberately unmatched. Requires human verification.

### WR-05: Substitute trigger accessible name
**Commit:** f5c2a43
**Files:** `frontend/components/recipes/cook/ingredient-groups.tsx`, `.planning/phases/09-offline-rules-engine/09-UI-SPEC.md`, `09-07-PLAN.md`
**Applied fix:** `aria-label="Find substitute for {name}"`; UI-SPEC (and the plan that duplicated the string) updated. No component test infrastructure exists for this component, so no test was added.

### WR-06: No live-region announcements
**Commit:** 983ad41
**Files:** `frontend/lib/rules/view-model.ts`, `view-model.test.ts`, `frontend/components/recipes/cook/cook-list-states.tsx`, `frontend/app/(app)/recipes/cook/page.tsx`
**Applied fix:** Added `resultsAnnouncement` and an sr-only polite `role="status"` region on the page (result count, nothing matches, error); the skeleton now has `role="status"` and `aria-label="Loading recipes"` (so loading is not announced twice).

## Skipped Issues

None.

---

_Fixed: 2026-10-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
