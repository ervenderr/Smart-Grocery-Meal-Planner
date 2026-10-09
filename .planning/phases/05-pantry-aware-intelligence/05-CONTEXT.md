# Phase 5: Pantry-Aware Intelligence - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Generated shopping lists contain only what the user actually needs to buy, and the app shows what to cook before food expires. Covers INT-01..INT-05: ingredient parsing into quantity + unit + canonical name with exact (no float drift) quantities; merging the same ingredient across recipes with unit conversion inside a unit family (count units are never converted to volume/weight); subtracting what the pantry already has; user-editable staples that never appear in generated lists; and a deterministic (no AI) "Cook this first" ranking of the user's own recipes by soon-to-expire pantry items. Out of scope: "bought it" -> pantry and "cooked it" deduction (Phase 6), barcode (Phase 6), volume<->mass conversion (needs ingredient densities, deferred), AI changes.

</domain>

<decisions>
## Implementation Decisions

### Ingredient model and parsing (INT-01)
- Recipe ingredients are already structured JSON (`Recipe.ingredientsList`: `ingredientName`, `quantity`, `unit`, `notes`); pantry items have `ingredientName`, `quantity` Decimal(10,2), `unit` (PantryUnit enum values such as kg, grams, lbs, cups, ml, pieces; verify the exact enum in `backend/src/types/pantry.types.ts`), `expiryDate`.
- Add a pure, well-tested backend module (e.g. `backend/src/modules/intelligence/`): `canonicalName(raw)` (lowercase, trim, collapse spaces, strip punctuation, conservative plural -> singular, small alias map e.g. scallions/green onions; no aggressive stemming), `parseIngredientLine("2 1/2 cups all-purpose flour")` -> `{quantity, unit, name}` for free text (fractions, ranges take the larger, unicode fractions like ½, "a pinch", "to taste" -> no quantity), and a unit registry: families `mass` (g, kg, lb, oz), `volume` (ml, l, tsp, tbsp, cup, fl oz if present), `count` (pieces, clove, slice, can, etc. and unknown free-text units). Exact arithmetic with integers/BigInt or Prisma.Decimal (decimal.js ships with @prisma/client; do not use JS floats for quantities); define base units (e.g. mg for mass, microliter for volume) and rounding rules (round half up to 2 decimals on output) with tests for the classic float traps (0.1+0.2, 1/3 thirds summing to 1).
- Frontend gets the same canonical-name and parse helper only where needed (shopping quick-add accepts "2 kg rice" typed as one line and splits it using the shared rules via the backend or a mirrored pure helper with a parity test).

### Merge and conversion (INT-02)
- When generating from a meal plan: scale by servings (existing aggregation), group by canonical name, convert within a family to base units, sum, then convert back to a friendly display unit (e.g. 1500 g -> 1.5 kg; choose a documented rule such as "the largest unit in the family that keeps quantity >= 1, preferring the unit used most in the inputs"). Different families for the same canonical name (e.g. "milk" in cups and in pieces) are NOT merged and NOT converted: kept as separate lines.
- Existing Phase 4 merge into the active list also uses canonical name + family conversion for unchecked items (so "500 g flour" + "1 kg flour" becomes "1.5 kg flour"); checked items stay untouched.

### Pantry subtraction (INT-03, user decision: subtract and keep a note)
- Pantry stock per canonical name is summed within a family (converted to base units); needed - stock, floored at 0; only the missing amount is added. Fully covered ingredients are NOT added but are returned in the response as `covered: [{name, needed, have, unit}]` and shown in the UI as a collapsed "Already in your pantry" note on the Shopping page after generating (and in the Meal Plans "Add to my list" result toast/preview) so nothing is a surprise. Partially covered items show "have X, need Y" in the note.
- Expired pantry items (expiryDate < today) do NOT count as stock. If pantry and recipe use incompatible families for a name, no subtraction (add the full amount) and flag it in `covered`/notes as "can't compare units".
- Soft-deleted pantry items are ignored; scoping is always per user.

### Staples (INT-04, user decision: starter list + editable)
- Stored as an additive column `UserPreference.stapleNames String[]` (column default = a starter list: salt, black pepper, pepper, cooking oil, vegetable oil, olive oil, sugar, flour, water, ... choose ~15 sensible entries, canonical-name form) via a new additive migration; existing rows receive the default. Edit via the existing preferences update endpoint (validated: max 100 entries, 1-60 chars, canonicalized and de-duplicated) and a Settings "Staples" section (chip list with remove, add input, reset to defaults). Never touch the already-applied migrations.
- Generated lists skip staples (matched by canonical name) and report them as `skippedStaples` (shown as a small "Skipped staples" note); manually added items are never filtered.

### Cook this first (INT-05, user decision: dashboard card + Recipes sort)
- Deterministic scoring in a pure backend function: for each of the user's (non-deleted) recipes, match ingredients to non-expired pantry items by canonical name (family-compatible quantity check optional: presence is enough for ranking, but show coverage %), score by urgency weights (days to expiry: 0-1 days highest, 2-3, 4-7; expired excluded or flagged), sum over distinct matched expiring items; tie-break by higher ingredient coverage then shorter total time then name. No AI call, no quota use.
- Backend endpoint (e.g. `GET /api/v1/recipes/cook-first?limit=`) returns ranked recipes with `usesExpiring: [{name, daysLeft}]`, `coveragePercent`; frontend: top-3 card on the dashboard ("Cook this first") with the expiring items it uses, and a "Use expiring first" sort option on the Recipes page with badges. Empty state when no expiring items match ("Nothing expiring that your recipes use").
- Respect dietary restrictions? NOT in this phase's ranking (it ranks the user's own saved recipes); do not send anything to AI.

### API/Contract and compatibility
- Extend the existing `POST /api/v1/shopping/generate` response additively: `{list, added, merged, covered, skippedStaples}` (frontend from Phase 4 must keep working if the new fields are absent). Respect the 300-item cap and transaction/lock rules from Phase 4. Keep ownership checks and validation conventions (express-validator, error shape `message/error/code`).
- No new npm packages. Backend: Jest tests for every pure function (table-driven) plus integration tests (generate with pantry + staples + conversions, cook-first ranking, staples preference validation). Frontend: Vitest for pure helpers; lint, type-check, `next build`.

### Delivery
- Backend first: additive migration (stapleNames), deploy to Railway (`cd backend && railway link --project kitcha --environment production`, confirm `railway status` shows `kitcha`, `railway up --service kitcha-api --detach`, verify migration logs and /health, extend `scripts/smoke-prod.sh` with intelligence checks using its own smoke user), THEN push the frontend to main (Vercel auto). CI must stay green. A real-phone/manual check of the Shopping "already in your pantry" note and the dashboard card is a final deferrable checkpoint.

### Housekeeping to fold in (small)
- Backend `getPeriodKey` in analytics builds the week key with the calendar year + ISO week number (e.g. Dec 30 can become `2024-W01`): fix to use the ISO week-year, with tests, as one small task (frontend parser from the dashboard fix already tolerates both).

### Claude's Discretion
Module and file names, exact starter staples list, display-unit rule details, alias map contents, scoring weights, plan splitting and waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4 shopping module: `shopping.merge.ts`, `shopping-generate.service.ts`, `shopping.units.ts`, `shopping.category.ts` (inferCategory), `mealplan.aggregate.ts` (servings-scaled aggregation, pure), `shopping.repository.ts` (list lock/transaction helpers).
- Pantry module (items with expiry, soft delete, `getExpiringSoon`), recipes module (ingredientsList JSON), `UserPreference` model + preferences endpoint and Settings page (`preferences-settings.tsx`), dashboard page (expiring-soon widget uses `frontend/lib/pantry/expiry.ts`), `frontend/lib/shopping/*` (vocab, grouping, totals, parsers), `EmptyState`, shared `Modal`.

### Established Patterns
- Pure helpers + table-driven tests; express-validator; additive Prisma migrations applied on deploy; React Query with a shared mutation scope for shopping; frontend contracts verified against backend serializers.

### Integration Points
- `POST /shopping/generate`, shopping page "Already in your pantry"/"Skipped staples" notes, mealplans "Add to my list", dashboard "Cook this first" card, Recipes page sort, Settings staples section, preferences validation.

</code_context>

<specifics>
## Specific Ideas

"Cook this first" is the main differentiator: it uses the expiry dates the user already enters, costs no AI quota, and reduces food waste, the app's core promise.

</specifics>

<deferred>
## Deferred Ideas

- Volume<->mass conversion with ingredient densities; fuzzy/semantic ingredient matching; synonym learning.
- "Bought it" -> pantry and "cooked it" deduction (Phase 6); barcode scan (Phase 6).
- Dietary-aware ranking, multi-household pantries (v2).

</deferred>
