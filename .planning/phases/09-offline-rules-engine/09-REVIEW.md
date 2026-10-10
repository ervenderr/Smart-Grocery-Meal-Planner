---
phase: 09-offline-rules-engine
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - frontend/lib/rules/match.ts
  - frontend/lib/rules/rank.ts
  - frontend/lib/rules/diet.ts
  - frontend/lib/rules/units.ts
  - frontend/lib/rules/pantry-index.ts
  - frontend/lib/rules/substitutions.ts
  - frontend/lib/rules/substitution-schema.ts
  - frontend/lib/rules/cook-data.ts
  - frontend/lib/rules/format-amount.ts
  - frontend/lib/rules/view-model.ts
  - frontend/lib/rules/relative-time.ts
  - frontend/lib/rules/staples-default.ts
  - frontend/lib/rules/types.ts
  - frontend/lib/rules/index.ts
  - frontend/lib/rules/data/substitutions.json
  - frontend/lib/hooks/use-cook-from-pantry.ts
  - frontend/components/recipes/cook/filter-card.tsx
  - frontend/components/recipes/cook/substitute-sheet.tsx
  - frontend/components/recipes/cook/recipe-row.tsx
  - frontend/components/recipes/cook/coverage-bar.tsx
  - frontend/components/recipes/cook/swap-card.tsx
  - frontend/components/recipes/cook/cook-list-states.tsx
  - frontend/components/recipes/cook/ingredient-groups.tsx
  - frontend/app/(app)/recipes/cook/page.tsx
  - frontend/app/(app)/recipes/cook/cook-results-list.tsx
  - frontend/app/(app)/recipes/page.tsx
  - frontend/components/dashboard/cook-first-card.tsx
  - frontend/lib/navigation.ts
  - backend/tests/rules-parity-diet.test.ts
  - backend/tests/rules-parity-cook-first.test.ts
  - backend/tests/rules-parity-units.test.ts
  - backend/tests/rules-parity-staples.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 32 (test files in frontend/lib/rules/*.test.ts and the large fixture/JSON data were skimmed, not line-audited)
**Status:** issues_found

## Summary

The engine is well structured: pure, frozen outputs, injected "today", no network or storage imports in `lib/rules` (grep confirmed), files all under 800 lines. The main concerns are around the dietary-safety path (allergen restrictions can be silently dropped), a crash path outside the engine's try/catch, and user-visible copy bugs ("need 0", "Ready to cook" on empty recipes).

## Critical Issues

### CR-01: Dietary restrictions are silently dropped (cap and unloaded prefs) while UI implies filtering is on

**File:** `frontend/lib/rules/diet.ts:129-134`, `frontend/lib/hooks/use-cook-from-pantry.ts:91-104`
**Issue:** Two independent paths make allergen filtering fail open with no signal to the user.
1. `compileRestrictions` slices to the first `MAX_RESTRICTIONS` (20) entries of the raw, unsorted list. Any restriction past 20 (for example a peanut allergy) is ignored with no warning. `findSubstitutes` (substitutions.ts:159) uses the uncapped list for tags, so the two filters also disagree.
2. `restrictions = prefs?.dietaryRestrictions ?? EMPTY_LIST`. While preferences are loading, errored, or not cached offline, restrictions is empty, ranking runs with no diet filter, and `FilterCard` hides the diet chip and summary (`dietRestrictions.length > 0`). Users with allergies see unfiltered recipes and no indication the filter is off. `status` does not wait on `prefsQuery`.
**Fix:**
```ts
// hook: do not rank until prefs resolve; surface failure
const prefsReady = prefsQuery.isSuccess;
const hasData = Boolean(pantryQuery.data && recipesQuery.data && prefsReady);
// diet.ts: normalize first, then never silently truncate: either raise the cap
// well above realistic input or return a flag so the UI shows "some restrictions not applied".
```
Add a visible warning in `FilterCard` when prefs are unavailable or restrictions were truncated.

## Warnings

### WR-01: Unguarded cast can crash the page outside the engine's try/catch

**File:** `frontend/lib/hooks/use-cook-from-pantry.ts:98-102`
**Issue:** `(recipesRaw as Recipe[]).map((r) => [r.id, r])` throws on a null/non-object row from a corrupted persisted cache (the same data `normalizeRecipes` defends against). The exception happens in `useMemo` during render, so `safeRank` does not protect it and the whole page errors.
**Fix:** Build the map from rows filtered with an `isRecord`-style guard, or key it off `normalizeRecipes` output ids and look up the raw recipe lazily.

### WR-02: "Ready to cook" pill shown for recipes with zero usable ingredients

**File:** `frontend/lib/rules/view-model.ts:19-22`
**Issue:** `missingCount === 0` yields the "Ready to cook" pill even when `totalCount === 0`, while `rank.ts:86` correctly sets `readyToCook = false` for those. The row also reads "You have 0 of 0 ingredients" and a 0% bar next to a green "Ready" pill.
**Fix:** Use `r.readyToCook` for the pill; add a neutral "No ingredients listed" label when `totalCount === 0`.

### WR-03: "need 0" rendered for ingredients with no quantity

**File:** `frontend/lib/rules/view-model.ts:40-55`, `frontend/lib/rules/match.ts:100-103,137-138`
**Issue:** `normalizeIngredients` maps missing/invalid quantity to 0. `groupNeeds` then yields no families, and `resolveWithStock`/`resolveWithoutStock` set `needed = 0`. `formatMatchLine` prints "need 0, have 3" or "need 0", and `substituteContextLine` prints "Recipe needs 0 Name." (with `getSubstitutes` also passing quantity 0 to the scaler).
**Fix:** Branch in `formatMatchLine` and `substituteContextLine` on `m.needed <= 0` and render "amount not specified" (or just the name).

### WR-04: Token-subset substitution matching can suggest wrong swaps

**File:** `frontend/lib/rules/substitutions.ts:61-65`
**Issue:** The file header says "a wrong swap is worse than no swap", but `tokenSubsetKey` matches any canonical name that contains all key tokens. A recipe line like "peanut butter", "coconut milk" or "buttermilk powder" resolves to "butter"/"milk" if no longer key exists, producing swaps for the wrong ingredient and a misleading "Find substitute" button. Only entries with longer keys protect against this, which is a data-completeness dependency with no test enforcing it.
**Fix:** Add a deny-list or require the key to be the head noun (last token of the canonical name), and add test cases for "peanut butter", "coconut milk", "almond milk".

### WR-05: Substitute trigger accessible name does not contain visible label

**File:** `frontend/components/recipes/cook/ingredient-groups.tsx:66-70`
**Issue:** Visible text is "Find substitute" but `aria-label="Substitute for {name}"` omits it (WCAG 2.5.3 Label in Name; breaks voice control "click Find substitute"). The UI-SPEC prescribes the aria-label, so the spec itself needs correcting.
**Fix:** `aria-label={`Find substitute for ${m.name}`}` (and update 09-UI-SPEC.md line 85 and any test).

### WR-06: No live-region announcement for result changes and loading

**File:** `frontend/app/(app)/recipes/cook/page.tsx:62-73`, `frontend/components/recipes/cook/cook-list-states.tsx:9`
**Issue:** Toggling filters re-ranks the list with no announcement; the skeleton sets `aria-busy` but there is no status region or label, so screen-reader users get no feedback on loading, "Nothing matches" empty states, or result count changes.
**Fix:** Add a visually hidden `role="status"` element announcing "{n} recipes" / loading / empty state, and give the skeleton `role="status"` with `aria-label="Loading recipes"`.

## Info

### IN-01: Stale "today" and "now" for long-lived pages

**File:** `frontend/lib/hooks/use-cook-from-pantry.ts:111`, `frontend/app/(app)/recipes/cook/page.tsx:23`
**Issue:** `useMemo(() => localDateString(), [])` and `useState(() => Date.now())` freeze at mount; an installed PWA left open across midnight shows wrong expiry days and "as of" text.
**Fix:** Recompute on `visibilitychange`/focus or key `today` to the query's `dataUpdatedAt`.

### IN-02: `visible` page size does not reset when filters change

**File:** `frontend/app/(app)/recipes/cook/page.tsx:20,58-59`
**Issue:** After "Show more", toggling a filter keeps a large `visible`; harmless but inconsistent with the "top 50" note.
**Fix:** Reset `setVisible(INITIAL_VISIBLE)` in the toggle handlers.

### IN-03: `unitMismatch` grants full coverage credit

**File:** `frontend/lib/rules/match.ts:111-121`
**Issue:** Having 1 g of an item when the recipe needs 3 cups counts as 100% credit and appears in "have". It is labeled "(different unit)" and probably intentional for parity with the server, but it inflates coverage and `readyToCook`. Document it or give partial credit.
**Fix:** Add a comment citing the parity decision, or credit it at a reduced weight.

### IN-04: Object.freeze on Maps gives false immutability

**File:** `frontend/lib/rules/pantry-index.ts:61,66`, `frontend/lib/rules/match.ts:66`
**Issue:** `Object.freeze(map)` does not prevent `.set()`/`.delete()`; the `ReadonlyMap` cast is type-only. `fetchAllPages` (cook-data.ts:110) also reallocates the array every page.
**Fix:** Rely on the readonly types and drop the misleading freeze, or wrap in a read-only view.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
