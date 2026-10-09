---
phase: 05-pantry-aware-intelligence
fixed_at: 2026-10-09T00:00:00Z
review_path: .planning/phases/05-pantry-aware-intelligence/05-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-10-09
**Source review:** .planning/phases/05-pantry-aware-intelligence/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, WR-01..WR-07)
- Fixed: 9
- Skipped: 0

Gates: backend tsc OK, lint 0 errors, full jest 52 suites / 977 tests pass (temporary Postgres 16, removed afterwards). Frontend lint 0 errors, type-check OK, vitest 32 files / 406 tests pass, `next build` OK.

## Fixed Issues

### CR-01: canonicalName truncates at the first comma/colon and strips parentheticals

**Files modified:** `backend/src/modules/intelligence/canonical.ts`, `backend/tests/fixtures/canonical-cases.json` (new, shared), `backend/tests/intelligence-canonical.test.ts`
**Commit:** ca8c9c0
**Applied fix:** Rule: split on comma/colon/parenthetical. A segment is dropped only if every word is in an explicit prep-note allowlist (chopped, diced, fresh, to taste, optional, ...) or it is a parenthetical containing digits or measurement words. Other segments are qualifiers kept in the identity. When the head noun is in a small category list (pepper, oil, sugar, flour, ...), the qualifier moves in front, so "Pepper, black" == "Black pepper", "Oil, olive" == "olive oil", "Sugar (brown)" == "brown sugar". Otherwise the written order is kept ("chicken breast"). Pepper/oil/sugar/chicken variants all stay distinct. Table tests now read the shared fixture. Behavior change: "Salt: coarse" is now `coarse salt` (no longer the `salt` staple).
**Status note:** logic change, requires human verification of the allowlist and category lists.

### CR-02: Staple `pepper` swallows the vegetable "peppers"

**Files modified:** `backend/src/modules/intelligence/staples.ts`, `backend/tests/intelligence-staples.test.ts`
**Commit:** 6b044cc
**Applied fix:** Staple matching stays exact canonical equality (never substring), and bare discrete counts (family count, unit `pieces`) are never treated as staples, so "3 peppers" is kept while "1 tsp pepper" is still skipped. Defaults unchanged (no schema/migration edit). Tests: bell/chili pepper, salt vs salted butter, oil vs sesame/olive oil, "Pepper, black" matches the `black pepper` default, "brown sugar" is not a staple.
**Status note:** logic change, requires human verification.

### WR-01: Frontend staple normalization diverges from the backend

**Files modified:** `frontend/lib/preferences/canonical.ts` (new mirror), `frontend/lib/preferences/canonical.test.ts` (parity test on the shared fixture), `frontend/lib/preferences/staples.ts`, `frontend/lib/preferences/staples.test.ts`, `frontend/components/settings/staples-settings.tsx`
**Commit:** 2cc9525
**Applied fix:** `addStaple` canonicalizes with the mirrored rule, rejects text with no letters/numbers ("!!!") with a message, splits on commas ("salt, pepper" adds two), dedupes on canonical (tomato/Tomatoes) and checks the cap against the final count. The settings form allows longer input and shows a comma hint. The mutation already set state from the server response. Trade-off: because comma splits, "pepper, black" is entered as "black pepper".

### WR-02: Smoke check 13 not re-runnable

**Files modified:** `scripts/smoke-prod.sh`
**Commit:** f510883
**Applied fix:** Recipe, pantry and ingredient names carry the per-run `$EPOCH` tag and assertions match the tagged names. Added 13h (regenerate adds 0). Syntax checked with `bash -n` and the jq filters were exercised on sample JSON; not run against a live API.

### WR-03: Cook-first truncates inputs, pantry read not deterministic

**Files modified:** `backend/src/modules/intelligence/cook-first.service.ts`, `backend/tests/recipe-cook-first.test.ts`, `frontend/lib/recipes/cook-first.ts`, `frontend/lib/recipes/cook-first.test.ts`, `frontend/app/(app)/recipes/page.tsx`
**Commit:** 88d8edc
**Applied fix:** Pantry query ordered `expiryDate asc, createdAt asc`. Response includes `recipesCapped`; the frontend field is optional and the Recipes page shows a small note under "Use expiring first". Tests cover the cap helper and `recipesCapped: false`; the ordering itself and a 500-recipe cap were not exercised end to end.

### WR-04: Generate reads plan and pantry outside the transaction

**Files modified:** `backend/src/modules/shopping/shopping-generate.service.ts`, `backend/tests/shopping-generate.test.ts`
**Commit:** 485b03d
**Applied fix:** Plan, preferences, pantry and list rows are all read inside the transaction after `ensureActiveListId` (list row lock). Test: a 404 plan leaves no list behind (atomic rollback). A pantry edit does not take the list lock, so it can still interleave; reads are at least as fresh as the lock.

### WR-05: Regenerating the same plan double-counts

**Files modified:** `backend/src/modules/intelligence/list-subtract.ts` (new), `backend/src/modules/intelligence/pantry-subtract.ts`, `backend/src/modules/shopping/shopping-generate.service.ts`, `backend/tests/intelligence-list-subtract.test.ts` (new), `backend/tests/shopping-generate.test.ts`, `backend/tests/intelligence-generate.test.ts`, `frontend/types/shopping.types.ts`, `frontend/lib/shopping/covered-note.ts`, `frontend/lib/shopping/generate-summary.ts` (+ tests)
**Commits:** e81536f, 485b03d, 825cfb7
**Applied fix:** Unchecked list items are subtracted like pantry stock (exact Decimal, same canonical name + unit family) and reported in `covered` with status `on_list`; checked items do not count. Generating twice yields added 0, merged 0. Frontend line text "Already on your list"; summary no longer blames the pantry for on_list entries. Three existing Phase 4/5 tests that asserted the old double-count (second generate merged to 6, 1.5 kg, 3.75) were deliberately updated to the new semantics; tests added for twice-generate, checked-item, partial top-up.
**Status note:** logic change, requires human verification.

### WR-06: Count-unit plural stemming

**Files modified:** `backend/src/modules/intelligence/units.ts`, `backend/tests/intelligence-units.test.ts`
**Commit:** 52e269c
**Applied fix:** `depluralize` strips `es` after ch/sh/x and `s` otherwise (bunches/bunch, pinches/pinch, slices/slice, cans/can, cloves/clove) with table tests.

### WR-07: Empty plan check counts lines, not usable quantities

**Files modified:** `backend/src/modules/shopping/shopping-generate.service.ts`, `backend/tests/shopping-generate.test.ts`
**Commit:** 485b03d
**Applied fix:** `MEAL_PLAN_EMPTY` is raised when `groups.length === 0` (before staples/pantry), so zero-quantity or unnameable lines give 400; fully covered plans still return 200 with added 0. Test added for an all-zero-quantity plan.
**Status note:** logic change, requires human verification.

## Skipped Issues

None. Info findings IN-01..IN-05 were out of scope and not touched.

---

_Fixed: 2026-10-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
