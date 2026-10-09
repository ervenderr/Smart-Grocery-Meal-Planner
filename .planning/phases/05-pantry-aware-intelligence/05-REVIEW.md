---
phase: 05-pantry-aware-intelligence
reviewed: 2026-10-09T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - backend/src/modules/intelligence/canonical.ts
  - backend/src/modules/intelligence/quantity.ts
  - backend/src/modules/intelligence/units.ts
  - backend/src/modules/intelligence/parse-line.ts
  - backend/src/modules/intelligence/merge-groups.ts
  - backend/src/modules/intelligence/pantry-subtract.ts
  - backend/src/modules/intelligence/staples.ts
  - backend/src/modules/intelligence/cook-first.ts
  - backend/src/modules/intelligence/cook-first.service.ts
  - backend/src/modules/analytics/iso-week.ts
  - backend/src/modules/mealplan/mealplan.aggregate.ts
  - backend/src/modules/shopping/shopping-generate.service.ts
  - backend/src/modules/shopping/shopping.merge.ts
  - backend/src/modules/shopping/shopping.repository.ts
  - backend/src/modules/users/users.service.ts
  - backend/src/modules/users/users.validation.ts
  - backend/src/modules/recipe/recipe.controller.ts
  - backend/src/modules/recipe/recipe.routes.ts
  - backend/src/modules/recipe/recipe.validation.ts
  - backend/src/modules/recipe/recipe.format.ts
  - backend/prisma/migrations/20261012000000_user_staple_names/migration.sql
  - frontend/lib/recipes/cook-first.ts
  - frontend/lib/preferences/staples.ts
  - frontend/lib/shopping/covered-note.ts
  - frontend/lib/shopping/parse-line.ts
  - frontend/lib/api/recipes.ts
  - frontend/lib/hooks/use-generate-shopping-list.ts
  - frontend/components/dashboard/cook-first-card.tsx
  - frontend/components/settings/staples-settings.tsx
  - frontend/components/shopping/pantry-note.tsx
  - frontend/components/shopping/quick-add.tsx
  - frontend/app/(app)/recipes/page.tsx
  - frontend/app/(app)/dashboard/page.tsx
  - scripts/smoke-prod.sh
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 34 (staples-settings.tsx, dashboard/mealplans/shopping pages were only skimmed via diff context; not every line verified)

## Summary

Decimal arithmetic is sound: the isolated clone (precision 40), sum-in-base-then-divide-last, a single rounding point, and conversion factors (US tsp, tbsp, fl oz, cup, oz, lb) all check out against the exact definitions. Mass, volume and count are kept apart. The parser uses linear scans with no ReDoS exposure. Staples validation correctly returns 400 and the Phase 4 transaction/lock ordering is preserved. The real defects are in canonicalName: it over-merges unrelated ingredients, and the staples filter then silently deletes items from shopping lists. There are also gaps in the over-cap and regenerate paths.

## Critical Issues

### CR-01: canonicalName truncates at the first comma/colon and strips parentheticals, merging distinct ingredients

**File:** `backend/src/modules/intelligence/canonical.ts:56-59`
**Issue:** `cleanText` drops everything after the first `,` or `:` and removes all `(...)` groups. "Pepper, black" and "Pepper, red flakes" both become `pepper`. "Oil, olive" and "Oil, sesame" become `oil`. "Chicken, breast" and "Chicken, thigh" become `chicken`. "Sugar (brown)" and "Sugar (powdered)" become `sugar`. These then:
1. Group together in `groupIngredients`, so quantities are summed across different products. The display name is only the first one seen.
2. Match pantry stock of the wrong product in `subtractPantry`, so the user's shopping need is wrongly reduced.
3. Hit staples (`pepper`, `sugar`, `flour` are defaults), so a distinct ingredient is dropped from the list entirely and reported as a "skipped staple".

The comma cut is intended for trailing prep notes ("onion, diced"), but it cannot tell prep notes from qualifiers.
**Fix:** Do not truncate at commas. Strip only a known prep-descriptor tail, or keep the comma-split head and append the tail when it is not in a prep-word allowlist (diced, chopped, minced, sliced, divided, melted, softened, to taste). Parenthetical removal should apply only to parentheticals that contain digits or unit words. At minimum, add tests for "pepper, black" vs "pepper, red".

### CR-02: Staple `pepper` swallows the vegetable "peppers", and the same pattern applies to other default staples

**File:** `backend/src/modules/intelligence/staples.ts:14-30` with `canonical.ts:38-47`
**Issue:** A recipe line "3 peppers" or "2 red peppers" singularizes to `pepper` and matches the default staple `pepper` (intended: black pepper seasoning). Only exact `pepper` is affected, but "peppers" and "pepper" are the same key. A user who buys 3 bell/chili peppers for a recipe gets them silently skipped, and the UI says "Skipped staples: peppers". The same applies to `water` vs "waters", and to `flour` and `sugar` when the user means a specific product (see CR-01). The loss is a missing item on the grocery list with only a collapsed note as evidence.
**Fix:** Keep the singular form for staple matching, but do not apply it to units-bearing lines with count-family units (`pieces`, `can`, etc.). Cheaper alternative: ship the default as `ground pepper` / `black pepper` only and drop bare `pepper` from `DEFAULT_STAPLE_NAMES`. The Prisma default, the migration and the parity test must change together.

## Warnings

### WR-01: Frontend staple normalization diverges from the backend canonicalizer

**File:** `frontend/lib/preferences/staples.ts:10-27`
**Issue:** The client only lowercases and collapses whitespace. The server canonicalizes (singularize, alias, punctuation, comma cut, NFKC). Consequences:
- Adding "Tomatoes" then "tomato" passes the duplicate check, and the server collapses them.
- Input "!!!" or "," passes the client check, and the whole PATCH fails with 400 ("must contain letters or numbers") with the list stuck unsaved.
- "salt, pepper" (valid, 11 chars) is silently saved as just `salt`.
- The UI shows "tomatoes" until reload, then "tomato".
**Fix:** After the PATCH succeeds, set the staples state from the server response. In the client, reject names with no `\p{L}\p{N}` characters, and reject or split names containing `,` or `:`.

### WR-02: Smoke check 13 is not re-runnable

**File:** `scripts/smoke-prod.sh` (13e-13g)
**Issue:** The script states the smoke user's data remains afterwards. On a second run:
- A second "Smoke stir fry" recipe exists with identical title/score/time, so the tie falls to id order, and `.items[0].recipe.id == $id` fails about half the time.
- The unchecked "smoke bread flour" list item from the previous run absorbs the new quantity, giving 3 kg instead of 1.5 kg, so the assertion fails.
- Pantry "Smoke spinach" lots accumulate.
**Fix:** Use a per-run suffix in the item and recipe names (`SMOKE_TAG=$(date +%s)`) and assert on the tagged names. Alternatively delete the created recipe, plan, list items and pantry rows at the end of the check.

### WR-03: Cook-first silently truncates inputs, and the pantry read is not deterministic

**File:** `backend/src/modules/intelligence/cook-first.service.ts:41-50`
**Issue:** The pantry query uses `take: 2000` with no `orderBy`, so beyond 2000 rows the surviving subset is arbitrary and can differ between calls. The most urgent (soonest-expiring) lots can be the ones dropped, making `expiringCount` and rankings flap. Recipes are capped at 500 by `updatedAt`, and the Recipes page "Use expiring first" sort then silently hides older recipes with no indication (the normal list is paginated).
**Fix:** Add `orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }]` to the pantry query, as the generate path already does. Return a `truncated` flag and surface it in the recipes page.

### WR-04: Generate reads plan and pantry outside the transaction

**File:** `backend/src/modules/shopping/shopping-generate.service.ts:~84-92`
**Issue:** `loadPlanGroups` and `loadUserContext` run before `prisma.$transaction`. The list lock is taken only afterwards, so a concurrent pantry edit or plan edit between the read and the lock produces a subtraction against stale data. The window is small but real with double-submit, and the lock only serialises list writes.
**Fix:** Acceptable if documented; otherwise move the reads inside the transaction after `ensureActiveListId` and the row lock.

### WR-05: Regenerating the same plan double-counts

**File:** `backend/src/modules/shopping/shopping.merge.ts:62-95`
**Issue:** `subtractPantry` subtracts pantry only, never what is already on the shopping list. Generating the same plan twice (or two overlapping plans) adds the full remaining quantity again to the matched unchecked items. This is carried over from Phase 4, but the new `covered`/`merged` copy now implies the list is pantry-reconciled.
**Fix:** Document it, or surface "already on list" in the response. Longer term, offer a replace-for-plan mode.

### WR-06: Count-unit plural stemming differs between registry and parser ("bunches" does not merge with "bunch")

**File:** `backend/src/modules/intelligence/units.ts:62-68`
**Issue:** `depluralize` strips only a trailing `s`, so "bunches" becomes `bunche`, "pinches" becomes `pinche`, "dashes" becomes `dashe`. `parse-line.ts:countUnit` also handles the `es` form. Lines with "1 bunch" and "2 bunches" therefore land in separate groups and appear as two list rows.
**Fix:** Strip `es` after `ch`/`sh`/`x`/`ss`, matching `canonical.ts`.

### WR-07: Empty plan check counts lines, not usable quantities

**File:** `backend/src/modules/mealplan/mealplan.aggregate.ts:~55-70` with `shopping-generate.service.ts:~50`
**Issue:** `ingredientCount` counts lines before `groupIngredients` drops zero-quantity and empty-canonical lines. A plan whose lines are all zero quantity, or have names like "???", returns `groups: []` but passes the `MEAL_PLAN_EMPTY` check. The user gets a 200 with `added: 0` and no explanation. The same applies when everything is staples or covered, which is fine, but the response gives no distinct signal.
**Fix:** Base the empty check on `groups.length === 0` (before staples), and keep the 200 with a clear flag when everything was filtered later.

## Info

### IN-01: Over-aggressive and under-aggressive singularization edge cases

**File:** `backend/src/modules/intelligence/canonical.ts:38-47`
**Issue:** `shoes` becomes `sho` (3 chars passes `MIN_SINGULAR_LENGTH`). "leaves" becomes `leave`, so "bay leaves" vs "bay leaf" do not match. "cookies" becomes `cooky`. "oats" is invariant, so "oat" and "oats" do not match. Idempotence still holds. Add `leaf`/`leaves` handling and an irregular-plural map.

### IN-02: Backend `parse-line.ts` is not used by any production code

**File:** `backend/src/modules/intelligence/parse-line.ts`
**Issue:** The only importers are tests (the frontend has its own mirror). It ships as dead code that must be kept in sync by hand.
**Fix:** Either wire it into a backend path (e.g. quick-add validation) or keep it test-only, documented as the fixture oracle.

### IN-03: Parser drops oversized quantities into the name

**File:** `backend/src/modules/intelligence/parse-line.ts:236` and `frontend/lib/shopping/parse-line.ts`
**Issue:** "100000 g rice" returns `quantity: null` and name "g rice" (the unit is consumed, the number is dropped). Quick-add then treats the whole thing as a plain name only when `quantity === null`, so the item is added as "100000 g rice" correctly. The backend result with `name: "g rice"` is misleading to any future caller. Return the original text as the name when the quantity is rejected.

### IN-04: Duplicate React keys possible in PantryNote and stale date in dashboard card

**File:** `frontend/components/shopping/pantry-note.tsx:58`, `frontend/components/dashboard/cook-first-card.tsx:21`
**Issue:** `key={line}` can collide if two covered entries format identically. `useMemo(() => localDateString(), [])` freezes "today" for the lifetime of the mounted page, so a tab left open past midnight keeps ranking against yesterday until refetch. Use index-suffixed keys and recompute the date in `queryFn`.

### IN-05: Frontend quick-add sends unrounded quantity

**File:** `frontend/lib/shopping/parse-line.ts:281`
**Issue:** "1/3 cup flour" sends `0.3333333333333333`. The server stores two decimals, so it works, but the toast and optimistic UI may display the long value. Round to two places before sending.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
