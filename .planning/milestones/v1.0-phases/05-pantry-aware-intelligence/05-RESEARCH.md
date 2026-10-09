# Phase 5: Pantry-Aware Intelligence - Research

**Researched:** 2026-10-09
**Domain:** Pure-function ingredient intelligence (parse, canonicalize, unit-convert, merge, pantry subtract, staples, expiry ranking) on an existing Express + Prisma 5.22 + Postgres backend and Next.js frontend
**Confidence:** HIGH (codebase facts verified by reading code and running Prisma/decimal.js locally); MEDIUM on conversion/ladder/scoring choices (Claude's discretion, documented as recommendations)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ingredient model and parsing (INT-01)**
- Recipe ingredients are already structured JSON (`Recipe.ingredientsList`: `ingredientName`, `quantity`, `unit`, `notes`); pantry items have `ingredientName`, `quantity` Decimal(10,2), `unit` (PantryUnit enum values such as kg, grams, lbs, cups, ml, pieces; verify the exact enum in `backend/src/types/pantry.types.ts`), `expiryDate`.
- Add a pure, well-tested backend module (e.g. `backend/src/modules/intelligence/`): `canonicalName(raw)` (lowercase, trim, collapse spaces, strip punctuation, conservative plural -> singular, small alias map e.g. scallions/green onions; no aggressive stemming), `parseIngredientLine("2 1/2 cups all-purpose flour")` -> `{quantity, unit, name}` for free text (fractions, ranges take the larger, unicode fractions like ½, "a pinch", "to taste" -> no quantity), and a unit registry: families `mass` (g, kg, lb, oz), `volume` (ml, l, tsp, tbsp, cup, fl oz if present), `count` (pieces, clove, slice, can, etc. and unknown free-text units). Exact arithmetic with integers/BigInt or Prisma.Decimal (decimal.js ships with @prisma/client; do not use JS floats for quantities); define base units (e.g. mg for mass, microliter for volume) and rounding rules (round half up to 2 decimals on output) with tests for the classic float traps (0.1+0.2, 1/3 thirds summing to 1).
- Frontend gets the same canonical-name and parse helper only where needed (shopping quick-add accepts "2 kg rice" typed as one line and splits it using the shared rules via the backend or a mirrored pure helper with a parity test).

**Merge and conversion (INT-02)**
- When generating from a meal plan: scale by servings (existing aggregation), group by canonical name, convert within a family to base units, sum, then convert back to a friendly display unit (e.g. 1500 g -> 1.5 kg; choose a documented rule such as "the largest unit in the family that keeps quantity >= 1, preferring the unit used most in the inputs"). Different families for the same canonical name (e.g. "milk" in cups and in pieces) are NOT merged and NOT converted: kept as separate lines.
- Existing Phase 4 merge into the active list also uses canonical name + family conversion for unchecked items (so "500 g flour" + "1 kg flour" becomes "1.5 kg flour"); checked items stay untouched.

**Pantry subtraction (INT-03, user decision: subtract and keep a note)**
- Pantry stock per canonical name is summed within a family (converted to base units); needed - stock, floored at 0; only the missing amount is added. Fully covered ingredients are NOT added but are returned in the response as `covered: [{name, needed, have, unit}]` and shown in the UI as a collapsed "Already in your pantry" note on the Shopping page after generating (and in the Meal Plans "Add to my list" result toast/preview) so nothing is a surprise. Partially covered items show "have X, need Y" in the note.
- Expired pantry items (expiryDate < today) do NOT count as stock. If pantry and recipe use incompatible families for a name, no subtraction (add the full amount) and flag it in `covered`/notes as "can't compare units".
- Soft-deleted pantry items are ignored; scoping is always per user.

**Staples (INT-04, user decision: starter list + editable)**
- Stored as an additive column `UserPreference.stapleNames String[]` (column default = a starter list: salt, black pepper, pepper, cooking oil, vegetable oil, olive oil, sugar, flour, water, ... choose ~15 sensible entries, canonical-name form) via a new additive migration; existing rows receive the default. Edit via the existing preferences update endpoint (validated: max 100 entries, 1-60 chars, canonicalized and de-duplicated) and a Settings "Staples" section (chip list with remove, add input, reset to defaults). Never touch the already-applied migrations.
- Generated lists skip staples (matched by canonical name) and report them as `skippedStaples` (shown as a small "Skipped staples" note); manually added items are never filtered.

**Cook this first (INT-05, user decision: dashboard card + Recipes sort)**
- Deterministic scoring in a pure backend function: for each of the user's (non-deleted) recipes, match ingredients to non-expired pantry items by canonical name (family-compatible quantity check optional: presence is enough for ranking, but show coverage %), score by urgency weights (days to expiry: 0-1 days highest, 2-3, 4-7; expired excluded or flagged), sum over distinct matched expiring items; tie-break by higher ingredient coverage then shorter total time then name. No AI call, no quota use.
- Backend endpoint (e.g. `GET /api/v1/recipes/cook-first?limit=`) returns ranked recipes with `usesExpiring: [{name, daysLeft}]`, `coveragePercent`; frontend: top-3 card on the dashboard ("Cook this first") with the expiring items it uses, and a "Use expiring first" sort option on the Recipes page with badges. Empty state when no expiring items match ("Nothing expiring that your recipes use").
- Respect dietary restrictions? NOT in this phase's ranking (it ranks the user's own saved recipes); do not send anything to AI.

**API/Contract and compatibility**
- Extend the existing `POST /api/v1/shopping/generate` response additively: `{list, added, merged, covered, skippedStaples}` (frontend from Phase 4 must keep working if the new fields are absent). Respect the 300-item cap and transaction/lock rules from Phase 4. Keep ownership checks and validation conventions (express-validator, error shape `message/error/code`).
- No new npm packages. Backend: Jest tests for every pure function (table-driven) plus integration tests (generate with pantry + staples + conversions, cook-first ranking, staples preference validation). Frontend: Vitest for pure helpers; lint, type-check, `next build`.

**Delivery**
- Backend first: additive migration (stapleNames), deploy to Railway (`cd backend && railway link --project kitcha --environment production`, confirm `railway status` shows `kitcha`, `railway up --service kitcha-api --detach`, verify migration logs and /health, extend `scripts/smoke-prod.sh` with intelligence checks using its own smoke user), THEN push the frontend to main (Vercel auto). CI must stay green. A real-phone/manual check of the Shopping "already in your pantry" note and the dashboard card is a final deferrable checkpoint.

**Housekeeping to fold in (small)**
- Backend `getPeriodKey` in analytics builds the week key with the calendar year + ISO week number (e.g. Dec 30 can become `2024-W01`): fix to use the ISO week-year, with tests, as one small task (frontend parser from the dashboard fix already tolerates both).

### Claude's Discretion
Module and file names, exact starter staples list, display-unit rule details, alias map contents, scoring weights, plan splitting and waves.

### Deferred Ideas (OUT OF SCOPE)
- Volume<->mass conversion with ingredient densities; fuzzy/semantic ingredient matching; synonym learning.
- "Bought it" -> pantry and "cooked it" deduction (Phase 6); barcode scan (Phase 6).
- Dietary-aware ranking, multi-household pantries (v2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Ingredients parsed into quantity, unit, canonical name; quantities stored without float drift | Decimal clone (precision 40, ROUND_HALF_UP) verified; unit registry with exact constants; `canonicalName` rules; `parseIngredientLine` grammar; shopping/pantry columns already `numeric(10,2)` so storage is exact |
| INT-02 | Merge same ingredient across recipes, convert compatible units, never convert count to volume/weight | Family-keyed grouping (`mass`/`volume`/`count:<unit>`), base-unit sum, display-unit ladder; extension of `mergeIntoItems` to canonical+family keys and to update `unit` as well as `quantity` |
| INT-03 | Generated lists subtract pantry stock | Pantry fetch (1 query), per-family base-unit stock, expired excluded by UTC date, `covered` response with `status`, epsilon rule |
| INT-04 | User-editable staples excluded from generated lists | `String[] @default([...])` migration (diff verified), validation + canonicalization sanitizer, explicit service whitelist, `skippedStaples` |
| INT-05 | "Cook this first" ranks user's recipes by soon-to-expire pantry usage, no AI | Pure `rankCookFirst`, integer weights, deterministic tie-breaks, `GET /recipes/cook-first` registered before `/:id`, client-date param |
</phase_requirements>

## Summary

The phase is almost entirely pure-function work plus thin wiring. Recipes and pantry items are already structured (`ingredientName`, numeric `quantity`, `unit`); the recipe API only accepts `PantryUnit` values, while AI/legacy recipes may hold free-text units (the Phase 4 generate test seeds `clove`, `Pieces`, `Salt: coarse` this way). So `parseIngredientLine` is mostly a quick-add/free-text helper; the load-bearing code is the unit registry, canonical name, Decimal quantity math, and the merge/subtract pipeline that replaces the float-based `aggregateIngredients` + `mergeIntoItems` internals.

Exact arithmetic: use `Decimal` from `@prisma/client/runtime/library` (already imported by `shopping-generate.service.ts`) via a private `Decimal.clone({ precision: 40, rounding: ROUND_HALF_UP })` so Prisma's shared Decimal config is never mutated. Every US-customary constant (cup = 236.5882365 ml, tbsp, tsp, fl oz, lb, oz) is an exact finite decimal, so conversions are exact and the only rounding is the final `toFixed(2)`. Verified in this session: 1/3 + 1/3 + 1/3 -> `1.00`, 0.1 + 0.2 -> `0.3`, and 16 tbsp compares exactly equal to 1 cup (a float implementation would not). No BigInt, no new package.

Migration: `String[] @default([...])` generates `ADD COLUMN "staple_names" TEXT[] DEFAULT ARRAY[...]::TEXT[]` (verified with `prisma migrate diff` on 5.22.0). Existing rows get the default (Postgres fills on ADD COLUMN with DEFAULT). Hand-write the migration SQL from that output so `migrate diff --exit-code` stays clean. Delivery order (backend then frontend) is required because the frontend will read new additive fields.

**Primary recommendation:** Build `backend/src/modules/intelligence/` as a set of small pure files (`quantity.ts`, `units.ts`, `canonical.ts`, `parse-line.ts`, `merge-groups.ts`, `pantry-subtract.ts`, `cook-first.ts`, `staples.ts`) with table-driven Jest tests first; then rewire `aggregateIngredients`/`mergeIntoItems`/`generateFromMealPlan` to use them; add the migration + preference validation; then the `cook-first` endpoint; then the frontend; fold the ISO week-year fix in as an isolated small task.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canonical name, unit registry, Decimal math, parse line | API / Backend (pure module) | Browser (mirrored parse helper for quick-add only) | Money-like exactness and one source of truth; frontend mirror guarded by parity fixtures |
| Aggregate + merge + pantry subtraction + staples filter | API / Backend | — | Needs per-user DB reads under the Phase 4 list lock/transaction; authoritative |
| Staples storage and validation | Database (`user_preferences.staple_names`) | API (validation, canonicalization) | Per-user persisted preference; server canonicalizes so all clients agree |
| Cook-first ranking | API / Backend | — | Needs pantry + recipes join; no AI; deterministic, testable |
| "Days left" display | Browser | API (supplies `daysLeft` using client-provided local date) | Existing frontend `getDaysUntilExpiry` uses viewer-local date; backend must accept the client's date to avoid off-by-one |
| Covered / skipped-staples notes, Cook-first card, Recipes sort, Settings staples chips | Browser | — | Pure presentation of API fields |
| ISO week-year key | API / Backend (analytics) | Browser (parser already tolerant) | Backend produces the key |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` runtime `Decimal` (decimal.js) | 5.22.0 (installed) | Exact quantity arithmetic | Already used by shopping service; `Decimal.clone()` gives an isolated config [VERIFIED: local node run] |
| express-validator | installed | `stapleNames`, cook-first query validation | Project convention |
| Jest + ts-jest, supertest | installed | Pure + integration tests | Existing backend setup (`tests/*.test.ts`) |
| Vitest 5.0.3 | installed | Frontend pure helper tests | Existing (`npm test` = `vitest run`) |

### Supporting
None. No new npm packages (locked). Do not add `parse-ingredient`, `convert-units`, `fraction.js`, or `decimal.js` directly.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Decimal clone | Scaled BigInt (micro-units) | Cup/tbsp/tsp constants have up to 11 fractional digits; BigInt needs scale 10^12 and manual division rounding. Decimal is simpler and already present. |
| Decimal clone | Plain integer hundredths (Phase 4 approach) | Cannot represent unit conversion or servings ratios exactly; fine only for same-unit sums. |

**Installation:** none.

**Version verification:** `npx prisma --version` -> Prisma 5.22.0, @prisma/client 5.22.0 [VERIFIED: local]. decimal.js is not a top-level dependency (`backend/node_modules/decimal.js` absent); import only via `@prisma/client/runtime/library` as the codebase already does [VERIFIED: local ls + require].

## Package Legitimacy Audit

No external packages are installed in this phase. Section not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
POST /shopping/generate {mealPlanId}
  |
  v
[mealplan fetch: plan items + recipes (userId scoped)]  --404--> MEAL_PLAN_NOT_FOUND
  |
  v
aggregateExact(items)  (Decimal; servings ratio = qty*itemServ/recipeServ, divide last)
  -> groups keyed canonicalName + familyKey(mass | volume | count:<unit>)
  -> sum in base units (g / ml / count)
  |
  v
filterStaples(groups, prefs.stapleNames)  -------> skippedStaples[]
  |
  v
[1 query: pantry items userId, deletedAt null, quantity>0]  (+ 1 query: UserPreference.stapleNames)
subtractPantry(groups, stock, todayUtc)
  -> expired lots dropped; stock summed per canonical+family
  -> remaining = needed - stock (>=0); epsilon = half a hundredth of display unit
  -> covered[] {name, needed, have, unit, status: full | partial | incompatible}
  |
  v
toDisplayUnit(remaining)  (ladder; largest unit with qty >= threshold, in the majority input system)
  |
  v
BEGIN tx + list FOR UPDATE (Phase 4 ensureActiveListId)
  load list rows -> mergeIntoItems(existing unchecked, incoming)  [canonical+family key, convert, sum, update quantity AND unit]
  cap check (300) -> bulk UPDATE (quantity, unit) + createMany
COMMIT
  |
  v
200 {list, added, merged, covered, skippedStaples}

GET /recipes/cook-first?limit&today&includeAll
  -> [recipes: userId, deletedAt null] + [pantry: userId, deletedAt null, expiryDate != null]
  -> rankCookFirst(recipes, pantry, staples, today) -> top N with usesExpiring, coveragePercent
```

### Recommended Project Structure
```
backend/src/modules/intelligence/
├── quantity.ts          # Decimal clone, toDec(), round2(), constants
├── units.ts             # registry, aliases, resolveUnit(), toBase(), fromBase(), chooseDisplayUnit()
├── canonical.ts         # canonicalName(), singularize(), ALIASES
├── parse-line.ts        # parseIngredientLine(), parseQuantityText() (fractions, ranges)
├── merge-groups.ts      # groupIngredients(), familyKey(), sum + display conversion
├── pantry-subtract.ts   # subtractPantry()
├── staples.ts           # DEFAULT_STAPLE_NAMES, sanitizeStapleNames(), filterStaples()
├── cook-first.ts        # rankCookFirst() pure
├── cook-first.service.ts# DB reads + call pure fn
└── intelligence.types.ts
backend/src/modules/analytics/iso-week.ts   # isoWeekKey(date) pure (housekeeping)
backend/prisma/migrations/20261012000000_user_staple_names/migration.sql
frontend/lib/shopping/parse-line.ts (+ test)       # mirrored helper, parity fixtures
frontend/lib/shopping/covered-note.ts (+ test)     # formatting helpers for notes
frontend/lib/recipes/cook-first.ts (+ test)        # normalize payload, badge text
frontend/components/settings/staples-settings.tsx
frontend/components/shopping/pantry-note.tsx
frontend/components/dashboard/cook-first-card.tsx
```
Keep every file under ~250 lines (project cap 800, target 200-400). `mealplan.service.ts` is already 805 lines: do not add to it.

### Pattern 1: Isolated Decimal
```typescript
// Source: verified locally against @prisma/client 5.22.0 runtime
import { Decimal as PrismaDecimal } from '@prisma/client/runtime/library';

export const D = PrismaDecimal.clone({ precision: 40, rounding: PrismaDecimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export const toDec = (n: number | string): Dec => new D(typeof n === 'number' ? String(n) : n);
export const round2 = (d: Dec): Dec => d.toDecimalPlaces(2, D.ROUND_HALF_UP);
```
Never call `Decimal.set(...)` on the shared Prisma class. Never construct from arithmetic results of floats (`new D(1/3)` carries 16 digits of float noise); construct from the JSON number's string form (`String(0.1)` = `"0.1"`, exact).

Division only at two places: servings ratio and base->display conversion. Do `qty.times(itemServings).div(recipeServings)` (multiply before divide) and sum in base units before converting back; round only the final display value.

### Pattern 2: Family key and merge key
```typescript
type Family = 'mass' | 'volume' | 'count';
interface ResolvedUnit { family: Family; unitKey: string; toBase: Dec | null } // base: g, ml; count has none
// groupKey = `${canonicalName}\u0000${family === 'count' ? 'count:' + unitKey : family}`
```
- `count` units are only merged when the normalized unit text is equal. `pieces`, `items`, `pcs`, `pc`, `piece`, `item`, and empty unit all normalize to `pieces`. Distinct free-text units (`clove`, `can`, `slice`, `bunch`) stay distinct from each other and from `pieces` (never invent "1 clove = 1 piece"). Depluralize free-text units conservatively (`cloves` -> `clove`).
- mass and volume are never merged with each other or with count (density conversion is deferred).

### Pattern 3: Existing merge must update unit too
`bulkUpdateQuantities` currently sets only `quantity` (`UPDATE ... SET quantity = v.quantity`). Once "500 g flour" + "1 kg flour" merges into "1.5 kg", the existing row's `unit` must change. Extend to a `bulkUpdateItems(tx, listId, [{id, quantity, unit}])` with `(${id}::text, ${qty}::numeric(10,2), ${unit}::text)` in the same VALUES list; stay with `Prisma.sql` bound parameters and the `shopping_list_id = ${listId}` scope. `MergePlan.updates` type becomes `{id, quantity, unit}`.

### Anti-Patterns to Avoid
- **Converting then rounding at each step:** loses precision (0.33 cup is not 1/3 cup). Convert once, sum in base, round once.
- **Merging into a checked item or changing its unit:** checked items are untouched (locked).
- **Filtering staples inside `mergeIntoItems` or on manual add:** staples filter belongs to the generate pipeline only; manual adds are never filtered.
- **Using client `Date.now()`/server local date for "today" in pure functions:** pass `today` (a `YYYY-MM-DD` string or UTC-midnight Date) as a parameter.
- **Matching by `includes`/fuzzy:** deferred. Exact canonical equality only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exact decimals | Float math with `Math.round(x*100)/100` | `D` clone (Decimal) | Float traps (0.1+0.2, thirds) |
| Row-lock/transaction around list | New locking | Phase 4 `ensureActiveListId` + `FOR UPDATE` and 20s tx options | Already race-safe |
| Bulk row update | Loop of `update` | Extended `bulkUpdateItems` (single `UPDATE ... FROM (VALUES)`) | Avoid N+1 inside lock |
| Active list DTO | Manual mapping | `loadListDto` / `toListDto` | Existing |
| ISO week | Third-party date lib | Small `isoWeekKey` using UTC getters (verified below) | No new packages |
| Express validation errors | Custom error shape | Existing `validate` middleware + `{message, error, code}` | Convention |

**Key insight:** the intelligence is deceptively small per function but each has edge cases; the cheap protection is table-driven tests, not libraries (none allowed).

## Unit Registry and Conversion Constants (INT-01/02)

Enum in repo: `PantryUnit` = lbs, kg, grams, oz, cups, ml, liters, tsp, tbsp, fl_oz, pieces, items [VERIFIED: backend/src/types/pantry.types.ts]. The recipe API validates ingredient units with `isIn(Object.values(PantryUnit))`; AI/legacy data may hold other text. `normalizeUnit`/`coerceUnit` in `shopping.units.ts` keeps known PantryUnit casing and passes other short text through; `KNOWN_UNITS` aliases only `pcs`, `pc`, `piece`.

Use US customary volume (the app's units are US-style: cups, tbsp, tsp, fl_oz). All constants below are exact decimals:

| Unit key (stored name) | Family | Base (exact) | Aliases to recognise (lowercased, dots stripped) |
|-----|-----|-----|-----|
| `grams` | mass | 1 g | g, gram, grams, gm |
| `kg` | mass | 1000 g | kg, kgs, kilo, kilos, kilogram(s) |
| `oz` | mass | 28.349523125 g | oz, ounce, ounces |
| `lbs` | mass | 453.59237 g | lb, lbs, pound, pounds |
| `ml` | volume | 1 ml | ml, milliliter(s), millilitre(s) |
| `liters` | volume | 1000 ml | l, liter(s), litre(s) |
| `tsp` | volume | 4.92892159375 ml | tsp, tsps, teaspoon(s) |
| `tbsp` | volume | 14.78676478125 ml | tbsp, tbsps, tbs, tbl, tablespoon(s) |
| `fl_oz` | volume | 29.5735295625 ml | fl oz, fl. oz, fluid ounce(s), fl_oz, floz |
| `cups` | volume | 236.5882365 ml | cup, cups |
| `pieces` | count | — | piece(s), pc(s), pcs, item(s), items, "" |

Derivation: US gal = 3785.411784 ml exactly; cup = gal/16; tbsp = cup/16; tsp = cup/48; fl oz = cup/8; lb = 453.59237 g exactly; oz = lb/16 [CITED: NIST Handbook 44 / international avoirdupois definitions; verified numerically in this session: 16 oz = 1 lb, tbsp 14.78676478125, tsp 4.92892159375, fl oz 29.5735295625]. The "tsp = 4.92892 ml" figure in the brief matches. Cup = 236.5882365 ml (US legal cup is 240 ml for nutrition labels; for cooking use the customary exact value for consistency across tsp/tbsp/cup).

Rules and traps:
- Do NOT alias bare `c`, `t`, `T`, `l` is allowed only because the unit slot is explicit (`2 l milk`); in `parseIngredientLine` accept `l`/`L` only directly after a number. Bare `T`/`t`/`c` are ambiguous: leave them as free-text count units.
- `oz` is mass, `fl oz`/`fl_oz` is volume. In free text "8 oz milk" is ambiguous by recipe convention; treat as mass (documented) so it matches the enum; do not special-case dairy.
- Plural alias: lowercase and strip trailing `.`; then look up.
- Unit text for output must be in the PantryUnit vocabulary (`grams`, `kg`, `lbs`, `oz`, `liters`, `ml`, `cups`, `tbsp`, `tsp`, `fl_oz`, `pieces`) so the frontend `SHOPPING_UNITS` select shows it (frontend vocab matches the enum exactly [VERIFIED: frontend/lib/shopping/vocab.ts]). Free-text count units stay as the user's text.

### Display-unit rule (documented recommendation, discretion)
1. System: tally the input units of the group by their system (`metric`: grams, kg, ml, liters; `us`: oz, lbs, tsp, tbsp, fl_oz, cups). Majority wins; tie -> metric. If the user's `preferredUnit` (kg/g -> metric, lb/oz -> US) exists it may break ties for mass; optional.
2. Ladder (choose the LAST rung whose threshold the total reaches):
   - Metric mass: grams (0) -> kg (>= 1000 g).
   - US mass: oz (0) -> lbs (>= 16 oz = 1 lb).
   - Metric volume: ml (0) -> liters (>= 1000 ml).
   - US volume: tsp (0) -> tbsp (>= 1 tbsp = 3 tsp) -> cups (>= 1/4 cup = 4 tbsp). `fl_oz` is never auto-chosen unless it is the only unit used in the inputs, then ladder fl_oz (0) -> cups (>= 1 cup).
3. Count groups keep the unit text unchanged.
4. Apply `round2` last; if a positive value rounds to 0.00, use the next smaller rung; if still 0.00, clamp to `MIN_QUANTITY` 0.01 (matches existing `shopping.constants.ts`). Clamp upper bound to `MAX_QUANTITY` 99999.
5. Phase 4 regression note: a single input unit still goes through the ladder (2000 grams -> 2 kg). This changes existing visible behavior; update the Phase 4 tests that assert same-unit sums (see Validation Architecture).

Drift caveat: stored list quantities are 2-decimal, so merging "0.33 cups" (previously stored 1/3 cup) into a new total converts from the rounded value. Acceptable; document in a code comment and do not try to store higher precision (column is `numeric(10,2)`).

## Canonical Name (INT-01)

`canonicalName(raw)` is a **matching key**, never the display text (display keeps the first-seen trimmed original, same as the Phase 4 "first-seen text wins" rule). Because only consistency matters, conservative rules suffice:

1. NFKC normalize, lowercase, replace `&` with ` and `.
2. Remove parenthesized text `(...)` and anything after the first comma (prep notes: "onion, finely diced"). Remove a trailing colon note after the first `:` ("Salt: coarse" -> "salt"). Phase 4 had a bug truncating names at `:` in the aggregation key; the display name must still keep the full original text (test it).
3. Replace hyphens and other punctuation with a space except keep inner apostrophes removed (`confectioner's` -> `confectioners`). Collapse whitespace, trim.
4. Singularize the LAST token only:
   - `ies` -> `y` (berries -> berry) except invariants list.
   - `oes` -> `o` (tomatoes, potatoes, mangoes).
   - `ches`, `shes`, `sses`, `xes` -> strip `es` (peaches, radishes).
   - else strip a single trailing `s` unless the token ends with `ss`, `us`, `is`, or is in the invariant set (`hummus`, `asparagus`, `couscous`, `molasses`, `swiss`, `oats`, `grits`, `lemongrass`, `watercress`, `bass`, `citrus`, `series`, `species`).
   - Min token length 3 after strip. Never touch tokens not ending in `s`.
   - `leaves` -> `leave` is wrong but consistent on both sides; acceptable.
5. Apply the alias map to the full normalized string: `scallion`, `spring onion`, `green onion` -> `green onion`; `aubergine` -> `eggplant`; `courgette` -> `zucchini`; `capsicum` -> `bell pepper`; `garbanzo bean`, `garbanzo` -> `chickpea`; `prawn` -> `shrimp`; `icing sugar`, `confectioners sugar` -> `powdered sugar`; `bicarbonate of soda` -> `baking soda`; `plain flour` -> `all purpose flour`; `coriander leaf` -> `cilantro`. Keep the map small and exported for tests. Do not alias `pepper` (it is a staple on its own; `bell pepper` is a different canonical key).

Matching ambiguity to accept and document: "chicken" does not match "chicken breast" (fuzzy matching deferred).

## Parsing (INT-01)

`parseIngredientLine(line)` -> `{ quantity: Dec | null, unit: string | null, name: string, note?: string }`. Grammar (anchored, linear scans, no nested quantifiers to avoid ReDoS; cap input length at 200 chars):

- Unicode fractions: map `½ ⅓ ⅔ ¼ ¾ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅐ ⅛ ⅜ ⅝ ⅞ ⅑ ⅒` to rational `n/d`; also fraction slash `⁄` (U+2044).
- Mixed forms: `1½`, `1 ½`, `2 1/2`, `1-1/2` (hyphen between whole and fraction), decimals `1.5`, `.5`. Thousands separator `1,000` only when followed by exactly three digits. No comma-decimal.
- Ranges: `2-3`, `2 - 3`, `2–3`, `2 to 3`, `1/2-1`: take the larger (locked).
- Rational values are kept as numerator/denominator and converted with a single `div`, then `round2` only when emitted as a shopping quantity.
- No-quantity phrases (return `quantity: null`, name = rest): `a pinch of`, `pinch`, `dash`, `to taste`, `as needed`, `some`, `a few`, `a handful`. A leading `a`/`an` before a unit word counts as quantity 1 (`a clove garlic`).
- Parenthetical sizes `1 (14 oz) can tomatoes`: ignore the parenthetical for quantity/unit (quantity 1, unit `can`), keep it as `note`.
- After quantity, try the longest unit alias (two-word `fl oz`, `fluid ounce`), then single-word. A word that is not a known unit is NOT swallowed as a unit: `3 eggs` -> `{3, null->pieces, "eggs"}`; `2 cloves garlic` -> unit `clove` only if the token is a short known/free-text unit candidate: define a small free-text count-unit allowlist (`clove, can, slice, bunch, sprig, stalk, head, package, pack, jar, bottle, stick, dozen, pinch`) so `2 large eggs` does not become unit `large`.
- Leading `of` after unit is dropped (`2 cups of flour`).
- Quantity bounds: result must be > 0 and <= 99999, else treated as no quantity.

Frontend quick-add: the form has separate name/quantity/unit fields (`QuickAdd`; `parseQuantityInput` accepts only digits with up to 2 decimals). One-line entry ("2 kg rice") is a **mirrored pure helper** `frontend/lib/shopping/parse-line.ts` with integer math (no Decimal in the frontend): rational -> hundredths via integer rounding half up. Parity guard: one JSON fixture file `backend/tests/fixtures/parse-line-cases.json` (input -> expected `{quantity (string, 2dp), unit, name}`), read by the backend Jest test and by the frontend Vitest test through `fs.readFileSync(path.resolve(__dirname, '../../../backend/tests/fixtures/...'))`. Vitest runs in CI from the full checkout [VERIFIED: ci.yml checks out the whole repo]; Vercel build does not run tests so the cross-package read cannot break deployment. Only parse when the name field text begins with a digit/fraction (otherwise treat as a plain name), and only if the quantity/unit fields are untouched.

## Pantry Subtraction (INT-03)

Inputs: `groups` (post-staples), `pantryItems` (select `ingredientName, quantity, unit, expiryDate` where `userId`, `deletedAt: null`; no pagination, expect tens to low hundreds of rows per user), `todayUtc`.

Algorithm per group (canonical + family):
1. Stock = sum over pantry items with same canonical name AND same family(+count unit) where `expiryDate == null || expiryDate >= todayUtc`; converted to base. Item with expiry today still counts (matches `getItems` "expiring" which uses `gte today`).
2. `remaining = max(needed - stock, 0)`.
3. Epsilon: if `remaining` converted to the display unit rounds (half up, 2 dp) to 0.00 -> treat as fully covered (avoids "add 0.01 cup" from 0.33 vs 1/3).
4. Status: `full` (remaining == 0), `partial` (0 < stock < needed), none when stock == 0 and there is no cross-family stock.
5. If stock in the same family is 0 but the pantry has the same canonical name in a different family (or a different count unit): `incompatible` entry, full amount added, `have` = pantry quantity in the pantry's own unit with `haveUnit`.
6. Response shape (additive; matches the locked `{name, needed, have, unit}` plus extras): `covered: Array<{ name: string; needed: number; have: number; unit: string; status: 'full' | 'partial' | 'incompatible'; haveUnit?: string }>`; `skippedStaples: string[]` (display names). Both optional in the frontend type for old-backend compatibility.

Expired lots: `expiryDate` is `@db.Date`; Prisma returns UTC-midnight `Date`. Compute `todayUtc` once as `new Date(); setUTCHours(0,0,0,0)` exactly like `pantry.service.ts` does, and pass it in (pure functions never read the clock). Optional client date for generate is unnecessary (stock cutoff off by at most one day is acceptable); for cook-first accept `today=YYYY-MM-DD` (below).

Order of operations: staples filter first (so staples never appear as covered), pantry subtraction second, merge into list last. The needed amount is NOT reduced by what is already on the active list (Phase 4 sums into unchecked lines; generating the same plan twice doubles quantities. This is existing behavior; do not "fix" it here, mention in the summary).

DB efficiency: generate adds exactly 2 reads before the transaction (pantry, preferences). Do them outside the list lock (aggregation already runs outside the transaction). No N+1: group in memory with a `Map`.

## Staples (INT-04)

- Column: `staple_names TEXT[] DEFAULT ARRAY[...]::TEXT[]`. Prisma schema line: `stapleNames String[] @default([...]) @map("staple_names")`.
- Verified `prisma migrate diff --from-schema-datamodel old --to-schema-datamodel new --script` (Prisma 5.22.0) emits exactly: `ALTER TABLE "user_preferences" ADD COLUMN     "staple_names" TEXT[] DEFAULT ARRAY['salt', 'black pepper', 'olive oil']::TEXT[];` [VERIFIED: local]. No `NOT NULL` is emitted for scalar lists (same as existing `alert_channels`). Postgres applies the DEFAULT to existing rows on ADD COLUMN, so all current users get the starter list with no UPDATE needed.
- Write the migration SQL as that statement with the full list. To avoid drift, `schema.prisma` default and migration default must be identical element-for-element and in the same order. Local drift check without a DB: `npx prisma migrate diff --from-schema-datamodel <git HEAD schema> --to-schema-datamodel prisma/schema.prisma --script` equals the migration SQL; with a DB in CI-like env: `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ... --exit-code` (needs a shadow database; the existing partial index `shopping_lists_one_active_per_user` is ignored by Prisma 5.22 diff per the Phase 4 migration comment, so exit code should remain 0). Not required by CI today; optional.
- Migration naming: existing folders are `YYYYMMDDHHMMSS_snake_name` and use future-dated timestamps (`20261011000000_shopping_active_list_unique` is the latest). The new folder must sort after it: use `20261012000000_user_staple_names`. Never edit applied migrations. CI runs `npx prisma migrate deploy` so a bad migration fails CI [VERIFIED: ci.yml].
- Constant `DEFAULT_STAPLE_NAMES` in `staples.ts` must equal the schema/migration default. Add a Jest test that reads `prisma/schema.prisma` and the new migration SQL, extracts the array, and asserts equality with the constant and that each entry satisfies `canonicalName(e) === e`.
- Suggested starter list (discretion, 15, canonical form): `salt`, `black pepper`, `pepper`, `water`, `sugar`, `flour`, `all purpose flour`, `cooking oil`, `vegetable oil`, `olive oil`, `baking soda`, `baking powder`, `cornstarch`, `vinegar`, `soy sauce`. (Note `pepper` canonical key is the spice; `bell pepper` is separate. Avoid `butter`, `garlic`, `onion`: not universal staples.)
- Validation (express-validator, appended to `updatePreferencesValidation`): `body('stapleNames').optional().isArray({ max: 100 })`, `body('stapleNames.*').isString().trim().isLength({ min: 1, max: 60 })`, then a final `body('stapleNames').optional().customSanitizer(canonicalize+dedupe)` plus a `custom` check that no element canonicalizes to empty (e.g. `"!!!"`). Reject (400, existing error shape) rather than silently dropping, except dedupe which is silent. Order matters: length check on raw trimmed string first, canonicalize after.
- **Whitelist trap:** `UsersService.updatePreferences` copies fields explicitly (`currency`, `budgetPerWeekCents`, ... `preferredUnit`); a new field is silently ignored unless added there. Also extend `UpdatePreferencesRequest` and `UserPreferencesResponse` in `src/types/user.types.ts`. `getPreferences` returns the Prisma row, so `stapleNames` appears automatically once the schema is generated.
- Missing preference row (legacy edge): fall back to `DEFAULT_STAPLE_NAMES` in code.
- Reset to defaults in UI: simplest single source of truth is the backend including `defaultStapleNames` in the preferences response (derived, not stored); alternative is a frontend constant plus parity test. Recommend the backend-supplied field (optional in the frontend type).
- Frontend type `UserPreferences.stapleNames?: string[]` (optional: older backend). `UpdatePreferencesData` adds `'stapleNames'`. The Settings Staples section uses its own mutation (partial update) so it does not collide with the existing `react-hook-form` preferences form; invalidate `PREFERENCES_QUERY_KEY` on success.

## Cook This First (INT-05)

Pure `rankCookFirst({ recipes, pantry, staples, today, limit, includeAll })`:

- Inputs reduced to: recipe `{ id, title, totalTimeMinutes (prep+cook), ingredients: [{name}] }`; pantry `{ name, expiryDate }`.
- Build `expiringByName: Map<canonicalName, minDaysLeft>`: only items with `expiryDate != null`, `daysLeft = utcDay(expiry) - utcDay(today)`, `0 <= daysLeft <= 7`. Expired (`daysLeft < 0`) are excluded from scoring and from coverage. Use `min` when several lots share a name.
- Weights (integers, discretion): `daysLeft <= 1` -> 5, `2..3` -> 3, `4..7` -> 1.
- For each recipe: distinct canonical ingredient names; `usesExpiring` = distinct names present in `expiringByName` (with `daysLeft`); `score` = sum of weights. `coveragePercent` = round(100 * covered / distinctIngredients) where covered = distinct names that are in non-expired pantry stock (any quantity) OR in staples (assumption A2: staples count as covered since the user has them; it keeps salt/oil from penalizing). Recipes with zero ingredients: coverage 0, score 0.
- Sort: score desc, coveragePercent desc, totalTimeMinutes asc, title (case-insensitive, `localeCompare`) asc, id asc. Fully deterministic.
- Default output: only `score > 0`; `includeAll=true` (used for the Recipes page sort) appends zero-score recipes in the same tie-break order. `limit` default 3, max 50.
- Response item: `{ id, name, category, difficulty, totalTimeMinutes, imageUrl, servings, score, usesExpiring: [{ name, daysLeft }], coveragePercent }`. Use `name` (frontend `Recipe.name`, backend maps `title` -> `name` in `formatRecipe`) not `title`. Include enough fields for the card and recipe cards; keep a stable `RecipeResponse`-compatible subset so the Recipes page can render its existing card (verify which fields `RecipeCard` needs when planning).
- Endpoint: `GET /api/v1/recipes/cook-first`. **Register before `/:id`** in `recipe.routes.ts` (the file already puts `/stats` first; `/:id` uses `validateRecipeId`, so a late registration would 400/404). Query validation: `limit` int 1-50, `today` optional `YYYY-MM-DD` (`isISO8601({strict:true})` and length 10) , `includeAll` boolean. Default `today` = server UTC date.
- **Date trap:** frontend computes days with the viewer's local date (`getDaysUntilExpiry`), the backend with UTC. Near midnight these differ by a day, producing "2d left" in the list vs "1d" on the card. Send `today` from the client (local date `YYYY-MM-DD`, same pattern Phase 4 finish uses for "User's local date") so both agree. Format locally, never via `toISOString().slice(0,10)` of `new Date()` (that is UTC).
- Queries: 2 total (`recipe.findMany` select `id,title,category,difficulty,imageUrl,servings,prepTimeMinutes,cookTimeMinutes,ingredientsList` where `userId, deletedAt: null`; `pantryItem.findMany` select `ingredientName,expiryDate,quantity` where `userId, deletedAt: null`), plus staples via `userPreference.findUnique`. Run with `Promise.all`. Expect tens to a few hundred recipes; no pagination needed; cap recipes loaded at e.g. 500 with `orderBy updatedAt desc` as a safety valve.
- Malformed `ingredientsList` entries (non-array, missing names) must be skipped, not throw (same guard style as `readIngredient`).
- Frontend: dashboard currently loads data with `useState` + `Promise.all(...catch(() => []))`; add the cook-first call to that array with a `.catch(() => [])` so a failure never crashes the home tab (Phase 4 dashboard crash lessons). Recipes page: add `<option value="expiring">Use expiring first</option>`; when selected, call `recipeApi.getCookFirst({ includeAll: true, limit: 50, today })` instead of `getAll` (ignoring pagination/other filters; disable or hide filter controls with a short note, or apply search/category client-side on the returned set). Add `'expiring'` to the `RecipeFilters.sortBy` union only if routed through `getAll`; recommended to keep it as a separate fetch path to avoid touching backend `getRecipes` sorting.

## ISO week-year fix (housekeeping)

Bug: `getPeriodKey` weekly branch uses `date.getFullYear()` with the ISO week number, so `2024-12-30` -> `2024-W01` (should be `2025-W01`) and `2021-01-03` -> `2021-W53` (should be `2020-W53`). Also uses local getters (`getFullYear/getMonth/getDate`); `receiptDate` is a `@db.Date` (UTC midnight), so use UTC getters.

Verified implementation (node run, cases below):
```typescript
export function isoWeekKey(date: Date): string {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);           // Thursday of this ISO week
  const weekYear = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(weekYear, 0, 1)) / 86_400_000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}
```
Verified outputs: 2024-12-30 -> `2025-W01`; 2021-01-03 -> `2020-W53`; 2026-12-31 -> `2026-W53`; 2027-01-01 -> `2026-W53`; 2020-12-31 -> `2020-W53`; 2026-01-01 -> `2026-W01` [VERIFIED: local node]. Extract to `analytics/iso-week.ts` (exported pure fn, testable; `getPeriodKey` is `private`), have `getPeriodKey` call it, and switch the daily/monthly branch to UTC getters too (`getUTCFullYear`, `getUTCMonth() + 1`). Remove `getWeekNumber` if unused. Existing tests in `tests/analytics.test.ts` should be checked for week-key expectations.

## Runtime / Integration Notes (how current code is consumed)

- `POST /shopping/generate` is consumed by `shoppingApi.generateFromMealPlan` -> `useGenerateShoppingList` (`onSuccess`: `setQueryData(queryKeys.shopping.active(), result.list)` and `toast.success(describeGenerateResult(result))`), used by the Meal Plans page ("Add to my list") and `GenerateFromPlan` on the Shopping page. `GenerateShoppingListResult` is `{list, added, merged}`; adding optional `covered?`/`skippedStaples?` is backward compatible. `describeGenerateResult` takes `{added, merged}`; extend (not break) it: when `added === 0 && merged === 0 && covered.length > 0` say the plan is already covered by the pantry instead of "already has everything from this plan".
- The Meal Plans page and Shopping page are different routes: the mutation result is lost on navigation. To show "Already in your pantry" on the Shopping page after "Open list", store the last result in the React Query cache under a new key (`queryKeys.shopping.lastGenerate()` = `['shopping','last-generate']`) via `setQueryData` in `onSuccess`, read with `useQuery({ enabled:false })` or `getQueryData`. Clear on user switch (Phase 4 pitfall 11: stale cached list across accounts; the existing logout handling clears the QueryClient, verify the key is under `['shopping']` so it is covered).
- `MealPlanService.generateShoppingList` -> `aggregateIngredients` is ALSO the data behind the Meal Plans page ingredient preview (`shoppingListData.items`). Recommended: reimplement `aggregateIngredients` internals with the exact grouping (same signature and return shape `{ingredientName, quantity, unit, recipes}`) so preview and generated list agree. Existing `tests/mealplan-aggregate.test.ts` cases (colon names, same name/unit case-insensitive, different units separate, servings multiplier fallback to 1, malformed data skip, 2-decimal rounding, no mutation) must be re-read: "different units separate" will intentionally change for same-family units (g + kg now merge), count vs mass stays separate.
- `mergeIntoItems` signature `(existing, incoming) -> {updates, inserts}` is used by generate and (verify) by the carry-over/finish flow; grep all callers before changing `MergePlan.updates` shape. `mergeKey(name, unit)` currently lowercases only: replace with canonical+family key; keep exported name or add `groupKey` and update `tests/shopping-merge.test.ts` (case/whitespace test still passes; plural-folding and unit conversion tests are new).
- Generate must keep the Phase 4 invariants: 300 cap check inside the lock; `rows.length + inserts > MAX_ITEMS_PER_LIST` -> `SHOPPING_LIST_FULL`; `MEAL_PLAN_EMPTY` when the plan yields zero ingredients. New nuance: if all ingredients are covered/skipped, `incoming` is empty AFTER filtering. This must NOT raise `MEAL_PLAN_EMPTY` (that error is for plans with no ingredients before filtering); return `added: 0, merged: 0` with `covered`/`skippedStaples` and still return the current list.
- `shopping.units.ts` `normalizeUnit` stays (used for manual items). The registry should wrap it: `resolveUnit(raw)` -> alias lookup first, else `coerceUnit` for count free text.

## Common Pitfalls

### Pitfall 1: Prefs whitelist silently drops `stapleNames`
**What goes wrong:** PATCH returns 200 but nothing saved. **Why:** `updatePreferences` lists fields explicitly. **Avoid:** add the field in service + types; integration test reads it back. **Warning sign:** staples revert on reload.

### Pitfall 2: Route order for `/recipes/cook-first`
**What goes wrong:** `/:id` swallows `cook-first` (validation error for non-UUID id). **Avoid:** register next to `/stats`, before `/:id`; supertest asserts 200.

### Pitfall 3: Float or double-rounding in merge
**What goes wrong:** 1/3 cup x3 -> 0.99 cups, 16 tbsp != 1 cup. **Avoid:** Decimal, convert once, round once (tests below).

### Pitfall 4: Existing line's unit not updated on merge
**What goes wrong:** "500 g" + "1 kg" would store `1.5` with unit `grams`. **Avoid:** `bulkUpdateItems` sets unit; assert in an integration test.

### Pitfall 5: `MEAL_PLAN_EMPTY` raised for fully-covered plans
See Runtime notes. Test: pantry covers everything -> 200 with `added: 0`, `covered` non-empty.

### Pitfall 6: UTC vs local "today"
Pantry `expiryDate` is a date-only UTC value; use UTC-midnight comparison; accept client `today` in cook-first. Test around boundary: expiry == today counts (daysLeft 0), expiry == yesterday excluded.

### Pitfall 7: Default-array drift between code, `schema.prisma`, and migration SQL
Parity test (above). Also never edit the older migrations.

### Pitfall 8: Singularization damaging names
`hummus`, `asparagus`, `couscous`, `molasses`, `oats` must survive; test table. Canonical used only for keys.

### Pitfall 9: Staples hiding real needs
`pepper` as a staple must not hide `bell pepper` (different canonical key) and `flour` not `almond flour`. Exact-equality matching ensures this; test it.

### Pitfall 10: Count units merged across different words
`2 cloves` + `3 pieces` of garlic stay separate lines (documented limitation). `pieces`/`items` merge.

### Pitfall 11: Backend deploy ordering
Frontend must tolerate absent fields (`covered?`, `skippedStaples?`, `stapleNames?`, `defaultStapleNames?`). Deploy backend first; verify migration log line and `/health` before pushing frontend.

### Pitfall 12: Locally no Postgres/Docker
Integration tests cannot run on this machine (no server on 5432, Docker daemon not running); they run in CI (postgres:16 service). Pure-function tests run locally. Plans should say so and rely on CI for integration, or start local Postgres via psql tooling if installed.

## Code Examples

### Sum, convert, display (sketch)
```typescript
// Source: verified constants; Decimal clone verified locally
const total = items.reduce((acc, i) => acc.plus(toDec(i.quantity).times(unitFactor(i.unit))), new D(0));
const { unit, value } = chooseDisplayUnit(family, system, total);   // ladder above
const out = Math.min(99999, Math.max(0.01, round2(value).toNumber()));
```

### Staples sanitizer
```typescript
export const sanitizeStapleNames = (raw: readonly string[]): string[] =>
  Array.from(new Set(raw.map(canonicalName).filter((n) => n.length > 0)));
```

### Extended bulk update (bound params only)
```typescript
const values = Prisma.join(
  updates.map((u) => Prisma.sql`(${u.id}::text, ${u.quantity.toFixed(2)}::numeric(10,2), ${u.unit}::text)`),
);
await tx.$executeRaw`
  UPDATE shopping_list_items AS item
  SET quantity = v.quantity, unit = v.unit, updated_at = now()
  FROM (VALUES ${values}) AS v(id, quantity, unit)
  WHERE item.id = v.id AND item.shopping_list_id = ${listId}`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Float sum + `Math.round(x*100)/100` keyed by lowercase name+unit | Decimal base-unit sum keyed by canonical name + family | This phase | g/kg, tsp/tbsp merge; plural names merge |
| Merge updates only `quantity` | Updates `quantity` and `unit` | This phase | Required for conversion |
| `getPeriodKey` calendar year + ISO week | ISO week-year via UTC | This phase | Fixes `2024-W01` for Dec 30 |

**Deprecated/outdated:** none in scope. Note: `railway.json` is deprecated (project STACK note) and not used; deploy via CLI as in CONTEXT.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Display-unit ladder thresholds (tbsp at 1 tbsp, cups at 1/4 cup, kg at 1000 g, lbs at 16 oz) and "majority input system" rule | Display-unit rule | Cosmetic; user may prefer different units. Confirm in discuss/plan if desired |
| A2 | Staples count as "covered" in cook-first coverage % | Cook This First | Coverage % slightly differs from user expectation |
| A3 | Score weights 5/3/1 and 15-item starter staples list | Cook This First / Staples | Cosmetic; tuneable constants |
| A4 | `oz` in free text is treated as mass, never fluid | Unit registry | "8 oz milk" shows as mass; acceptable per enum |
| A5 | Cup = 236.5882365 ml (customary) rather than metric 240 ml | Unit registry | Tiny conversion differences between cups and ml sums |
| A6 | Starter alias map entries and invariant plural words | Canonical Name | Missed merges; cheap to extend |
| A7 | Recipes number in tens to low hundreds and pantry items in tens to low hundreds per user (no counts verified in prod) | Cook This First / Pantry | If thousands, still fine in memory; add the 500-recipe safety cap |
| A8 | `mergeIntoItems` has no callers other than generate and tests (not grepped across `finish`) | Runtime notes | Planner must grep callers before changing `MergePlan` |

## Open Questions (RESOLVED)

All three were resolved by the orchestrator on 2026-10-09; see 05-CONTEXT.md, "Resolved research questions".

1. **Same-unit single-input groups through the ladder (2000 grams -> 2 kg)?**
   - Known: context example is 1500 g -> 1.5 kg after a mix. Phase 4 kept units as-is.
   - Unclear: whether users want unit changes when all inputs share a unit.
   - Recommendation: ladder always (consistent, predictable); keep the rule in one function so it is a one-line change.
   - RESOLVED (05-CONTEXT.md, Resolved research questions): the display ladder applies even to single-unit groups (2000 g -> 2 kg); affected Phase 4 test expectations are updated explicitly (plans 05-07, 05-09).
2. **Recipes page sort wiring.** Recommendation above (separate `cook-first` fetch with `includeAll`). Planner confirm `RecipeCard` field needs.
   - RESOLVED (05-CONTEXT.md, Resolved research questions): separate cook-first fetch with `includeAll` so all recipes are ranked; the endpoint returns full recipe payloads for `RecipeCard` (plans 05-08, 05-10).
3. **Reset-to-defaults source.** Recommend backend `defaultStapleNames`; frontend-constant alternative acceptable.
   - RESOLVED (05-CONTEXT.md, Resolved research questions): the backend supplies `defaultStapleNames`, with a parity test across the TS constant, `schema.prisma` and the migration SQL (plans 05-04, 05-06).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | 24.9.0 local (CI uses 22) | — |
| Prisma CLI | migration, diff | yes | 5.22.0 | — |
| Local PostgreSQL | integration tests | no (5432 not responding) | — | CI postgres:16 service; `psql` client present |
| Docker | local DB | no (daemon not running) | — | CI |
| Railway CLI | deploy | yes | 5.45.10 | — |
| curl, jq | smoke script | yes | — | — |

**Missing dependencies with no fallback:** none (integration tests rely on CI; planners should not require local DB runs).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | Jest (ts-jest preset), supertest; `tests/*.test.ts`, setup `tests/setup.ts`, `resetMocks/restoreMocks: true` |
| Frontend framework | Vitest 5.0.3 (`vitest run`) |
| Quick run | `cd backend && npx jest tests/intelligence- --silent` ; `cd frontend && npx vitest run lib/shopping lib/recipes` |
| Full suite | `cd backend && npm test -- --ci` ; `cd frontend && npm test && npm run lint && npm run type-check && npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | quantity math exact | unit table | `jest tests/intelligence-quantity.test.ts` | Wave 0 |
| INT-01 | unit registry/aliases/conversion | unit table | `jest tests/intelligence-units.test.ts` | Wave 0 |
| INT-01 | canonicalName | unit table | `jest tests/intelligence-canonical.test.ts` | Wave 0 |
| INT-01 | parseIngredientLine (+ fixtures) | unit table | `jest tests/intelligence-parse-line.test.ts`; `vitest run lib/shopping/parse-line.test.ts` | Wave 0 |
| INT-02 | grouping/merge/display unit; mergeIntoItems with conversion | unit table | `jest tests/intelligence-merge.test.ts tests/shopping-merge.test.ts tests/mealplan-aggregate.test.ts` | partly existing (update) |
| INT-03 | subtractPantry | unit table | `jest tests/intelligence-pantry-subtract.test.ts` | Wave 0 |
| INT-02/03/04 | generate end-to-end | integration | `jest tests/shopping-generate.test.ts tests/intelligence-generate.test.ts` | existing + new |
| INT-04 | staples sanitize/validation/default parity | unit + integration | `jest tests/intelligence-staples.test.ts tests/users.test.ts` | Wave 0 / existing |
| INT-05 | rankCookFirst | unit table | `jest tests/intelligence-cook-first.test.ts` | Wave 0 |
| INT-05 | endpoint | integration | `jest tests/recipe-cook-first.test.ts` | Wave 0 |
| housekeeping | isoWeekKey | unit table | `jest tests/analytics-iso-week.test.ts` | Wave 0 |
| Frontend | note formatting, generate summary, cook-first normalize | unit | `vitest run lib/shopping lib/recipes` | Wave 0 |

### Concrete table-driven cases

**quantity** (`D`, `round2`): `0.1+0.2 -> "0.3"`; `1/3+1/3+1/3 -> "1.00"`; `toDec(0.1)` exact; round half up: `1.005 -> 1.01`, `2.675 -> 2.68`, `0.004 -> 0.00`, `0.005 -> 0.01`; servings scale `1.5 * 3/2 -> 2.25`; `2 * 1/3 * 3 -> 2.00` (multiply before divide); no mutation of the shared Prisma Decimal precision (`PrismaDecimal.precision === 20` after use).

**units**: aliases `Tbsp, tablespoons, TBS -> tbsp`; `cup -> cups`; `fl. oz -> fl_oz`; `L -> liters`; `lb, pounds -> lbs`; `""`, `pcs`, `items` -> `pieces`; `clove` stays count:clove; `cloves -> clove`. Conversion exactness: `16 tbsp = 1 cups`; `3 tsp = 1 tbsp`; `48 tsp = 1 cups`; `8 fl_oz = 1 cups`; `16 oz = 1 lbs`; `1000 grams = 1 kg`; `1 lbs = 453.59237 grams`; round trip `500 grams + 1 kg -> 1.5 kg`; mass vs volume not convertible; count vs mass not convertible; display ladder cases: `1500 g -> 1.5 kg`; `999 g -> 999 grams`; `3 tsp -> 1 tbsp`; `4 tbsp -> 0.25 cups`; `2 tsp -> 2 tsp`; `20 oz (US) -> 1.25 lbs`; tiny `0.001 g -> 0.01 grams` clamp; majority-system tie -> metric.

**canonical**: `"  Tomatoes "->"tomato"`, `"Berries"->"berry"`, `"Peaches"->"peach"`, `"Potatoes"->"potato"`, `"Scallions"->"green onion"`, `"Green Onions"->"green onion"`, `"spring onion"->"green onion"`, `"Hummus"->"hummus"`, `"Asparagus"->"asparagus"`, `"Couscous"->"couscous"`, `"Rolled Oats"->"rolled oats"`, `"Cloves"->"clove"`, `"All-Purpose Flour"->"all purpose flour"`, `"Salt: coarse"->"salt"`, `"onion, finely diced"->"onion"`, `"Garlic (minced)"->"garlic"`, `"Chicken Breasts"->"chicken breast"`, `"  "->""`, `"!!!"->""`, `"Confectioner's sugar"->"powdered sugar"`, idempotence `canonicalName(canonicalName(x)) === canonicalName(x)` for every row, every `DEFAULT_STAPLE_NAMES` entry is a fixed point.

**parse-line** (shared fixture JSON): `"2 1/2 cups all-purpose flour" -> 2.5 cups "all-purpose flour"`; `"½ tsp salt" -> 0.5 tsp salt`; `"1½ cups milk" -> 1.5 cups`; `"1 ½ cups" -> 1.5`; `"2-3 tbsp oil" -> 3 tbsp`; `"2 to 3 lbs chicken" -> 3 lbs`; `"1/2-1 cup rice" -> 1 cups`; `"1,000 g flour" -> 1000 grams`; `"a pinch of salt" -> null qty`; `"salt to taste" -> null`; `"a clove garlic" -> 1 clove`; `"3 eggs" -> 3 pieces "eggs"`; `"2 large eggs" -> 2 pieces "large eggs"`; `"1 (14 oz) can tomatoes" -> 1 can tomatoes, note "14 oz"`; `"2 kg rice" -> 2 kg rice`; `"1/3 cup sugar" -> 0.33 (hundredths) cups`; `"0 cups x" -> null`; `"100000 g" -> null (over max)`; 5,000-char input does not hang (length cap, runs < 50 ms).

**merge-groups / mergeIntoItems**: `500 grams + 1 kg flour -> 1.5 kg`; `Flour` vs `flours` same group; `milk 1 cups + 2 pieces` separate lines; `1 cloves + 3 pieces garlic` separate; checked item untouched and new line created; two unchecked duplicates -> first absorbs; existing "500 grams flour" row + incoming "1 kg" -> update `{quantity:1.5, unit:'kg'}`; clamp at 99999; 0/negative skipped; frozen inputs not mutated; display name first-seen.

**pantry-subtract**: need 500 g, have 1 kg -> full covered, not added; need 1 kg, have 400 g -> remaining 0.6 kg, partial `{needed:1, have:0.4, unit:'kg'}`; need 1 cup, have 16 tbsp -> full; need `1/3 cup` (0.3333...), have `0.33 cups` -> full via epsilon; expired lot (yesterday) ignored, expiring-today counts; null expiry counts; two lots summed (200 g + 300 g); other family only (need 2 cups milk, have 1 piece) -> incompatible, full amount added, `haveUnit:'pieces'`; soft-deleted rows never passed in (integration); other user's pantry never counted (integration); zero-quantity pantry ignored; plural/case name match (`Tomatoes` vs `tomato`); no-pantry -> unchanged.

**staples**: sanitize `[" Salt ", "SALT", "olive oil"] -> ["salt","olive oil"]`; empty/`!!!` rejected by validation; 101 entries -> 400; 61-char -> 400; non-string -> 400; default parity test against `schema.prisma` + migration SQL; filter keeps `bell pepper` when `pepper` is staple; manual add of "salt" still allowed (`POST /shopping/items`).

**cook-first**: item expiring today beats item in 5 days; weights 0-1/2-3/4-7; expired excluded; same name two lots uses min days; recipe using 2 expiring items beats 1; tie -> higher coverage -> shorter total time -> title -> id; staples count toward coverage; deleted recipes excluded; other users' recipes excluded (integration); no expiring matches -> `[]` default, all recipes ordered when `includeAll`; `limit` clamp; malformed `ingredientsList` skipped; `today` param shifts `daysLeft`; invalid `today` -> 400; route not shadowed by `/:id`.

**iso-week**: `2024-12-30->2025-W01`, `2021-01-03->2020-W53`, `2026-12-31->2026-W53`, `2027-01-01->2026-W53`, `2020-12-31->2020-W53`, `2026-01-01->2026-W01`, `2024-12-29->2024-W52`, `2025-12-29->2026-W01`; TZ independence (run with `process.env.TZ` set differently inside a child or assert UTC getters only); daily/monthly keys use UTC.

**generate integration** (supertest, CI Postgres): pantry covers one ingredient fully, one partly, one incompatible; staples skipped and reported; g/kg merge; response keeps `list/added/merged` and adds `covered/skippedStaples`; fully covered plan -> 200 `added:0`; 300 cap still enforced; two concurrent generates keep one active list (existing test must still pass); other user's pantry irrelevant.

### Sampling Rate
- Per task commit: the relevant pure test file(s), `npx tsc --noEmit` (backend).
- Per wave merge: full backend `npm test -- --ci`, frontend `npm test`, lint, type-check.
- Phase gate: all of the above plus `next build`, CI green, prod smoke script intelligence checks.

### Wave 0 Gaps
- [ ] `backend/tests/intelligence-{quantity,units,canonical,parse-line,merge,pantry-subtract,staples,cook-first}.test.ts`
- [ ] `backend/tests/fixtures/parse-line-cases.json` (shared with frontend)
- [ ] `backend/tests/intelligence-generate.test.ts`, `recipe-cook-first.test.ts`, `analytics-iso-week.test.ts`
- [ ] Update `shopping-merge.test.ts`, `mealplan-aggregate.test.ts`, `shopping-generate.test.ts`, `users.test.ts` for new behavior
- [ ] Frontend tests: `lib/shopping/parse-line.test.ts`, `covered-note.test.ts`, `lib/recipes/cook-first.test.ts`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (existing JWT middleware on routes) | existing `authenticate` |
| V3 Session Management | no | — |
| V4 Access Control | yes | every pantry/recipe/prefs query filtered by `userId` from the token; tests with a second user |
| V5 Input Validation | yes | express-validator for `stapleNames` (array max 100, string 1-60), cook-first `limit/today/includeAll`; parse input length cap (200); linear parsing, no catastrophic regex |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via other users' pantry/recipes in ranking or subtraction | Information disclosure | `where: { userId }` on every query; integration tests with two users |
| SQL injection in extended bulk update | Tampering | `Prisma.sql` bound params, no interpolation (existing pattern) |
| ReDoS / CPU via long free-text lines | DoS | length cap, simple scans, test 5,000 chars |
| Oversized `stapleNames` payload | DoS | max 100 items, 60 chars each, body-size limit already enforced |
| Unbounded `limit` on cook-first | DoS | clamp 1-50 |
| Error messages leaking data | Information disclosure | existing `{message,error,code}` handler |

## Sources

### Primary (HIGH confidence)
- Repo code read this session: `shopping.merge.ts`, `shopping-generate.service.ts`, `shopping.units.ts`, `shopping.repository.ts`, `shopping.dto.ts`, `shopping.constants.ts`, `mealplan.aggregate.ts`, `mealplan.service.ts` (generateShoppingList), `pantry.service.ts` (getItems expiry filters), `pantry.types.ts`, `recipe.validation.ts`, `recipe.routes.ts`, `recipe.service.ts`, `users.validation.ts`, `users.service.ts`, `analytics.service.ts` (getPeriodKey), `schema.prisma`, migrations, `.github/workflows/ci.yml`, `jest.config.js`; frontend `lib/api/*`, `lib/hooks/use-generate-shopping-list.ts`, `lib/shopping/*`, `lib/pantry/expiry.ts`, dashboard/recipes/mealplans/settings pages, `lib/react-query.ts`.
- Local runs: `prisma migrate diff` output for `String[] @default`; decimal.js clone behaviors (thirds, 0.1+0.2, rounding, exact unit constants, shared precision unchanged at 20); ISO week outputs.

### Secondary (MEDIUM confidence)
- Unit constants derive from the international yard/pound and US gallon definitions (3.785411784 L, 453.59237 g); arithmetic verified, definitions recalled from standard references (NIST Handbook 44), not re-fetched this session.

### Tertiary (LOW confidence)
- Ladder thresholds, scoring weights, alias list, starter staples (Claude's discretion; see Assumptions Log).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages; Decimal behavior verified locally.
- Architecture: HIGH for integration points (read from code); MEDIUM for file layout (discretion).
- Pitfalls: HIGH, derived from concrete code facts (explicit field whitelist, route order, unit-not-updated, `MEAL_PLAN_EMPTY` interaction).

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (stable stack; Prisma pinned 5.22)

## Project Constraints (from CLAUDE.md and global rules)

- Keep Next.js + Express + Prisma + Postgres; stay on Prisma 5.22.x; no rewrite; free tiers; no secrets committed (Railway variables).
- Immutability: always build new objects, never mutate inputs (tests with frozen inputs).
- Small files (200-400 lines typical, <800 max; `mealplan.service.ts` already 805, do not grow it); functions < 50 lines; no deep nesting.
- Validate at boundaries (express-validator); explicit error handling; no silent swallow.
- Tests: TDD (RED then GREEN), 80%+ coverage, unit + integration (+ e2e for critical flows where it exists).
- Security: no hardcoded secrets, parameterized SQL, rate limits already on shopping routes; consistent API envelope/error shape (`message/error/code`).
- Commit format `<type>: <description>`; user-specified attribution per session reminder.
- Never use `railway.json`; deploy per CONTEXT (`railway link`, confirm `kitcha`, `railway up --service kitcha-api --detach`, verify migration and `/health`).
- UI (from 03-UI-SPEC, reuse): 44px touch targets (`min-h-11 min-w-11`), spacing multiples of 4 (no 12px gaps), only `text-base/sm/xl/2xl` (no new `text-xs`), weights 400/600 only, light theme, reuse `Card`, `EmptyState`, `Modal`, primary accent reserved for CTAs/selected chips, content above bottom nav (`pb-[calc(5rem+env(safe-area-inset-bottom))]`), inputs 16px below `lg`. New notes use gray/amber neutral styling, collapsed `aria-expanded` disclosure pattern like `GenerateFromPlan`.
