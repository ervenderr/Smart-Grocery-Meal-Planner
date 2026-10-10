# Phase 9: Offline Rules Engine - Research

**Researched:** 2026-10-10
**Domain:** Pure TypeScript ranking and substitution engine (client), parity with v1.0 server intelligence core
**Confidence:** HIGH (codebase-derived; no external libraries needed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pure, deterministic, side-effect-free module under `frontend/lib/` (e.g. `lib/rules/`), fully unit-tested with vitest; reuse the v1.0 pantry-aware matching/unit-family/Decimal-style logic where it exists on the server (research it; keep client and server results consistent, add parity tests on shared fixtures).
- Ranking: score recipes by ingredient coverage from pantry (quantity-aware, unit families), expiring-soon boost (use-it-up), missing-count penalty, optional diet/exclusion filters. Returns explainable result (have / missing / expiring-used) so UI can show why.
- Substitutions: curated static table (JSON) of common swaps with ratios/notes and dietary tags, lookup by normalized ingredient name with fuzzy/alias matching; works offline; sourced from the app's own data only.
- Surface in the web app now: a "Cook from what you have" ranked list and a "Substitute" affordance for missing ingredients, usable with the network off (data comes from React Query cache / existing recipes list). UI hint: yes - follow existing design system.
- Performance budget: ranking 500 recipes x 200 pantry items under ~100 ms on a mid phone.
- Must not depend on Capacitor APIs. Cooking itself (apply deduction) remains Phase 11.

### Claude's Discretion
File names, alias matching algorithm, table contents (aim for 150+ common swaps), UI placement.

### Deferred Ideas (OUT OF SCOPE)
- AI-generated plans offline (Phase 13), offline cook apply (Phase 11).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OFF-08 | Rules-based "what can I cook" ranking from the pantry and ingredient substitutions with no network and no model | Sections: Architecture (engine modules), Parity strategy, Substitution table design, Data sourcing hook, Validation Architecture |
</phase_requirements>

## Project Constraints (from CLAUDE.md)
- Keep Next.js + Express + Prisma stack; no rewrite. Immutability, files < 800 lines (aim 200-400), validation at boundaries, 80% coverage target, no hardcoded values.
- No secrets. Free/zero-cost preferred: add NO paid or heavy dependencies.
- GSD workflow: all edits go through GSD commands (planner/executor handle this).
- Global rules: TDD (RED/GREEN), immutable updates, user-friendly errors in UI, no emojis.
- Another agent works on Phase 7 (backend users/ai modules, settings, legal, consent UI): Phase 9 must not edit those areas. Notably `frontend/components/settings/*`, `backend/src/modules/users|ai` are off limits; reading `backend/src/modules/ai/dietary-filter.ts` for parity is fine, editing is not.

## Summary

The v1.0 server already has the building blocks: `canonicalName` (frontend mirror exists in `frontend/lib/preferences/canonical.ts`, parity-tested against `backend/tests/fixtures/canonical-cases.json`), staples (`DEFAULT_STAPLE_NAMES`, `resolveStaples`), the unit registry (`intelligence/units.ts`: mass base g, volume base ml, count never convertible) and `pantry-subtract.ts` (stock summed in base units per canonical name + unit family, expired lots ignored, incompatible families reported not converted). The server `rankCookFirst` is name-only (coverage = share of recipe ingredient names present as stock or staple; score = urgency weights 5/3/1 for expiry <=1 / <=3 / <=7 days). It is NOT quantity-aware, and it already caps at 500 recipes and 2000 pantry rows.

The new engine is therefore a client-side superset: reuse canonical naming, staples, unit-family conversion and the urgency weights, add quantity-aware coverage, missing-count penalty, diet/exclusion filtering and per-ingredient explanations. Nothing on the client currently converts units (there is no client `units.ts`; `lib/pantry/quantity.ts` only does steps/parsing) and nothing mirrors the server `dietary-filter.ts`. Both must be ported as small pure modules with fixture parity tests. No new npm dependencies are needed.

**Primary recommendation:** Build `frontend/lib/rules/` as five small pure modules (`units`, `diet`, `pantry-index`, `rank`, `substitutions` + `data/substitutions.json`), TDD with vitest, share fixtures via `backend/tests/fixtures/` (the existing pattern: frontend vitest reads the backend fixture JSON), and wire UI through a thin hook that reads React Query cache (`usePantryAll`/`useRecipesAll` + preferences) with `networkMode: 'offlineFirst'` semantics.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ranking and explainability | Browser / Client (pure lib) | — | Must run with no network; later reused by Capacitor shell (same JS bundle) |
| Substitution lookup | Browser / Client (pure lib + static JSON) | — | Static table bundled in app; no backend |
| Diet/exclusion filtering | Browser / Client (port of server rules) | API (existing AI filter stays) | Parity required; server filter remains for AI output |
| Data source (pantry, recipes, prefs) | Browser (React Query cache) | API (fetch when online) | Offline reads come from cache now; Phase 11 swaps in SQLite |
| Parity fixtures | Repo shared (`backend/tests/fixtures`) | both test runners | Existing convention |

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| vitest | 5.0.3 | Unit + benchmark tests for pure logic | Already configured: `frontend/vitest.config.ts`, include `lib/**/*.test.ts`, node env, `@` alias [VERIFIED: codebase] |
| @tanstack/react-query | ^5.90.8 | Data source for hook | Existing hooks and `queryKeys` [VERIFIED: codebase] |
| zod | ^4.1.12 | Optionally validate the static JSON at test time | Already a frontend dep [VERIFIED: codebase] |
| lucide-react, Radix Dialog via `components/ui/modal.tsx` | existing | UI per UI-SPEC | Reuse, do not add |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written alias+token matching | fuse.js / minisearch | Adds a dependency and non-deterministic scoring for a ~200-row table; canonicalName + alias map + token-subset match is deterministic and parity-friendly. Do not add. |
| decimal.js on client | plain numbers with round2 | Server uses Decimal (Prisma clone) to avoid float drift. Client only compares coverage for display; use numbers with an epsilon (1e-9) and round2 at output. Avoid new dependency. Risk noted in Pitfall 3. |

**Installation:** none. **Package Legitimacy Audit:** no external packages are recommended; slopcheck not required for this phase. [VERIFIED: no new deps]

## Architecture Patterns

### System Architecture Diagram

```
 React Query cache (pantry all pages, recipes all pages, preferences)
        |  (online: fetched; offline: served from cache, no refetch error)
        v
 useCookFromPantry() hook  --(useMemo)-->  rankRecipes(recipes, pantry, ctx)
                                              |
        ctx = { today (local date string), staples Set, dietRestrictions[], onlyReady }
                                              |
   pantry-index (canonical name -> {baseByFamily, nearestExpiryDays, lots[]})   built once per run
                                              |
   per recipe: for each ingredient -> canonicalName -> lookup -> convert units -> have/short/missing
                                              |
   score + sort (deterministic tie-breaks) -> RankedRecipe[] {coverage, have[], missing[], expiringUsed[]}
                                              |
   UI list (top 50) ... "Find substitute" on a missing row
                                              v
   findSubstitutes(ingredient, qty, unit, {pantryIndex, restrictions}) -> {swaps[], hiddenCount}
        ^ static substitutions.json (bundled, normalized at module load into alias->entry Map)
```

### Recommended Project Structure
```
frontend/lib/rules/
├── types.ts              # RankedRecipe, IngredientMatch, Swap, RulesContext
├── units.ts              # port of backend units registry (numbers, no Decimal)
├── diet.ts               # port of backend ai/dietary-filter.ts (buildForbiddenTerms, violates)
├── pantry-index.ts       # build index: canonical -> base totals per family, expiry
├── rank.ts               # rankRecipes + scoring constants (exported, named)
├── substitutions.ts      # normalize table, lookup, scale ratio, diet filter
├── data/substitutions.json   # 150+ entries
├── index.ts              # public barrel
└── *.test.ts (+ rank.bench.test.ts)
frontend/lib/hooks/use-cook-from-pantry.ts   # data assembly (not pure)
frontend/app/(app)/recipes/cook/page.tsx     # per UI-SPEC
frontend/components/recipes/cook/*           # RecipeRow, SubstituteSheet, FilterCard (small files)
```
Keep each file well under 400 lines; the JSON table is data, not code.

### Pattern 1: Pure engine with injected context
Engine never reads clock, network, localStorage or React. `today` is passed in (the existing `localDateString()` in `lib/recipes/cook-first.ts` and `getDaysUntilExpiry(expiry, now)` in `lib/pantry/expiry.ts` already follow this). Same inputs give same output online and offline (success criterion 3). Return new objects only (immutability rule); freeze constant tables.

### Pattern 2: Reuse the server semantics exactly where they exist
- Names: `canonicalName` from `@/lib/preferences/canonical` (already a verified mirror). Do not write a new normalizer.
- Staples: treat a recipe ingredient whose canonical name is in the staples Set as covered (server `rankCookFirst` does this: `stock.has(name) || staples.has(name)`). Source staples from `prefs.stapleNames` falling back to `DEFAULT_STAPLE_NAMES` (backend list; mirror to `frontend/lib/rules/staples-default.ts` or reuse `prefs.defaultStapleNames`, which the API returns). Note the "discrete count staple" exception in `filterStaples` ("3 peppers" is not a staple) - replicate for pieces-unit lines.
- Expired lots: ignored for stock and for expiring (server `indexPantry` skips `daysLeft < 0`).
- Expiring window and weights: 0-7 days; weight 5 (<=1), 3 (<=3), 1 (<=7), copied from `URGENCY_WEIGHTS`.
- Units: families mass(g) / volume(ml) / count (never convertible); factors: oz 28.349523125, lbs 453.59237, kg 1000, liters 1000, tsp 4.92892159375, tbsp 14.78676478125, fl_oz 29.5735295625, cups 236.5882365; unit aliases and count-unit depluralization from `units.ts`. Cross-family (e.g. recipe "2 cups rice" vs pantry "1 kg rice") is NOT convertible (no density data): server reports it as `incompatible`. Engine treat this as "present, quantity unknown": count it as covered-by-name with a flag `unitMismatch` (decision for planner, see Open Questions).
[CITED: backend/src/modules/intelligence/units.ts, cook-first.ts, pantry-subtract.ts, staples.ts]

### Pattern 3: Scoring (prescriptive, tunable constants in one file)
Per recipe, let N = distinct canonical ingredients (excluding none), each ingredient resolves to status `have` (stock >= need or staple), `partial` (stock > 0 but < need, same family), `unitMismatch`, or `missing`.
- `coverage` = sum over ingredients of min(1, haveBase/needBase) (partial credit; unitMismatch and staples = 1) divided by N. Expose as integer percent (matches existing `coveragePercent` field the UI shows).
- `missingCount` = count of `missing` + `partial`.
- `expiryBoost` = sum of urgency weights for ingredients whose pantry lot is expiring and actually used by the recipe (reuse 5/3/1), reported in `expiringUsed[{name, daysLeft}]`.
- Suggested score: `coverage*100 + expiryBoost*EXPIRY_POINTS - missingCount*MISSING_PENALTY`, with named constants (e.g. EXPIRY_POINTS 4, MISSING_PENALTY 6) exported and covered by tests. Ready-to-cook (missingCount 0) always sorts above any recipe with missing items unless the planner decides otherwise; tie-break chain copies server `compare`: score desc, coverage desc, totalTimeMinutes asc, name lowercase asc, id asc (fully deterministic; required for online/offline identity).
- Recipes with zero ingredients: coverage 0, sorted last (server gives 0).
[ASSUMED: exact weights; tune with fixtures. Constants must be unit-tested but are product choices.]

### Pattern 4: Substitution table (JSON, curated)
Entry shape (validate with zod in a test, not at runtime hot path):
```json
{
  "ingredient": "buttermilk",
  "aliases": ["cultured buttermilk"],
  "swaps": [
    { "name": "milk + lemon juice", "pantryNames": ["milk", "lemon juice"],
      "ratio": { "amount": 1, "unit": "cups", "per": 1, "perUnit": "cups" },
      "note": "Stir 1 tbsp lemon juice into 1 cup milk, rest 5 minutes.",
      "tags": ["vegetarian"], "rank": 1 }
  ]
}
```
- Lookup: canonicalName(input) -> exact key; else alias map (also canonicalized at load); else token-subset match (all tokens of the table key appear in the input, longest key wins, e.g. "unsalted butter" -> "butter"); else null. Deterministic, no scoring randomness. A fuzzy edit-distance fallback is not recommended (false positives are worse than "no swap", and the UI hides the trigger when no swap exists).
- Ratio scaling: pre-scale to the recipe quantity (UI-SPEC: "Use 3/4 cup honey for 1 cup sugar"). Format fractions (1/4, 1/3, 1/2, 2/3, 3/4) for volume units; otherwise round2 via `formatQuantity`.
- `tags` use the app's `DietaryRestriction` vocabulary (`vegetarian, vegan, gluten_free, dairy_free, nut_free, halal, kosher`) so filtering is exact for tags, plus keyword check via ported `violates()` on the swap name for free-text restrictions (preferences store `dietaryRestrictions: string[]`, free text).
- `inPantry`: swap's `pantryNames` all resolve to stock in the pantry index; these sort first (UI-SPEC).
- Content: 150+ entries; seed from public-domain common cooking knowledge (buttermilk, egg, baking powder, brown sugar, cake flour, honey/sugar, cream, sour cream/yogurt, soy sauce, butter/oil, lemon juice/vinegar, etc). CONTEXT says "sourced from the app's own data only": no scraping; author by hand. Include an `engineVersion`/`schemaVersion` field. Safety notes (allergens) belong in a global disclaimer per UI-SPEC.
[ASSUMED: culinary ratios are from training knowledge; flag for a human sanity-pass of the table. Wrong ratios are a quality risk, not a security one.]

### Anti-Patterns to Avoid
- Calling `recipeApi.getCookFirst` for the new screen: it is network-only and name-only; the new feature must not make any fetch on interaction.
- Importing `AISubstitutionModal` or anything from `lib/api/ai`.
- Floating Date/`new Date()` inside the engine (breaks determinism and tests).
- Mutating inputs (rule: immutability); sort copies.
- Using `Intl`/locale-dependent string compare for tie-break (use plain `<` comparisons like the server) so results are identical on every device.
- Treating cross-family quantities as convertible (no densities).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ingredient name normalization | New regex normalizer | `canonicalName` (`lib/preferences/canonical.ts`) | Already server-parity tested with shared fixture |
| Expiry day math | New date diff | `getDaysUntilExpiry` in `lib/pantry/expiry.ts` | Timezone-safe (date part only); has tests |
| Expiry label | New string | `formatExpiryLabel` | UI-SPEC mandates it |
| Today string | custom | `localDateString()` from `lib/recipes/cook-first.ts` | Existing |
| Quantity parse/format | custom | `parseQuantityInput`, `formatQuantity` in `lib/pantry/quantity.ts` | Existing |
| Diet keyword filter | new keyword lists | Port `backend/src/modules/ai/dietary-filter.ts` verbatim + parity fixture | Single source of truth for restriction semantics |
| Modal/sheet, empty state, skeleton | new | `components/ui/modal.tsx`, `EmptyState`, `components/common/skeleton` | UI-SPEC |
| Diet notice copy | new | mirror `DietFilterNotice` wording (reuse if props fit) | UI-SPEC |

## Runtime State Inventory
Not a rename/refactor phase: omitted. No stored data, services, OS state or secrets are touched. Build artifacts: none.

## Common Pitfalls

### Pitfall 1: Pagination hides data from the engine
**What goes wrong:** `pantryApi.getAll` max page size 100 (`pantry.validation.ts`), recipes max 200 (`recipe.validation.ts` limit 1-200). `usePantryList` returns one page only. Ranking 500 recipes x 200 pantry needs ALL pages.
**How to avoid:** Hook must page through all results (loop until `pagination.totalPages`) into dedicated query keys, e.g. `['recipes','all']`, `['pantry','all']`; keep within `queryKeys` factory. Cap at server caps (500 recipes, 2000 pantry) and surface `recipesCapped`-style note only if hit. Verify default page sizes with a read of `pantry.ts` before coding (not confirmed here).
**Warning signs:** Ranking differs from server `cook-first` on large accounts.

### Pitfall 2: Offline correctness depends on cache lifetime
**What goes wrong:** React Query defaults are `staleTime 5 min`, `gcTime 10 min` and there is NO persister installed (no `persistQueryClient` in package.json or `lib/react-query.ts`). Offline after a cold start or after 10 min gc'd inactivity, the cache is empty. Full offline persistence is Phase 11 (SQLite).
**How to avoid:** For Phase 9 define "offline" as: the engine itself does no network I/O and renders from whatever is in cache; when queries are `paused`/errored with no data show the UI-SPEC "Nothing saved on this device yet" EmptyState. Use `networkMode: 'offlineFirst'` on the two "all" queries and a long `gcTime` (e.g. 24h) so a session that goes offline keeps the data; do NOT add a persister (Phase 11) unless planner wants a cheap `@tanstack/react-query-persist-client` addition (out of scope; flag). Success criterion 1 verification: DevTools offline / `navigator.onLine` mock in a component-level or manual check, plus the pure engine tests.

### Pitfall 3: Float drift vs server Decimal
Server sums in base units with 40-digit Decimal. JS doubles can make `0.1+0.2` style errors that flip "have 1 cup, need 1 cup" to partial. Use an epsilon (1e-6 relative) in `have >= need` and round only for display. Parity tests must include boundary cases (exactly equal after unit conversion, e.g. 16 tbsp vs 1 cup: 16*14.78676478125 = 236.58823650 = 1 cup exactly in the registry).

### Pitfall 4: Pantry quantities arrive as strings
API returns Decimal as strings; `usePantryList` normalizes with `Number()`. A new "all" fetch must normalize too (and tolerate NaN/negative -> treat as 0). Validate untrusted cache shape at the boundary (the `normalizeCookFirst` pattern in `lib/recipes/cook-first.ts` is the house style).

### Pitfall 5: Matching mismatch between canonical forms
"pepper" is both a staple and the head of "bell pepper"; `canonicalName` handles qualifiers by category heads. Rely on exact canonical equality, never substring, for stock/staple matching (server comment: "oil" must not match "sesame oil"). Substring/token-subset matching is allowed ONLY in the substitution table lookup.

### Pitfall 6: Diet filter semantics are keyword-based, not a guarantee
The server filter is explicitly "best-effort, over-filters". Port as is and keep the disclaimer. For ranking filters: exclude a recipe if any ingredient name/recipe name violates; also respect `recipe.dietaryRestrictions` tags are NOT a safe-positive signal. Free-text restrictions are forbidden-term lists; do not invent a new vocabulary. Note preferences might be updated by the Phase 7 agent; read only `prefs.dietaryRestrictions` (existing field).

### Pitfall 7: Render cost, not engine cost
Ranking 500x200 is cheap; rendering 500 cards is not. UI-SPEC already caps to 50 + "Show more". Memoize with `useMemo` keyed on stable inputs; don't recompute on every expand toggle (keep expand state inside row components).

## Code Examples

### Pantry index (build once per run)
```typescript
// Source: pattern derived from backend/src/modules/intelligence/pantry-subtract.ts indexStock
export interface PantryEntry {
  readonly baseByFamily: ReadonlyMap<string, number>; // 'mass' | 'volume' | 'count:<unit>'
  readonly minDaysLeft: number | null;               // null = no expiry
  readonly displayName: string;
}
export function buildPantryIndex(items: readonly PantryItemLike[], todayIso: string): ReadonlyMap<string, PantryEntry> {
  const now = parseLocalDate(todayIso);
  const out = new Map<string, PantryEntry>();
  for (const it of items) {
    const name = canonicalName(it.ingredientName);
    const qty = Number(it.quantity);
    if (!name || !Number.isFinite(qty) || qty <= 0) continue;
    const days = getDaysUntilExpiry(it.expiryDate, now);
    if (days !== null && days < 0) continue; // expired lots ignored
    const u = resolveUnit(it.unit);
    // ...merge into out (new Map copy per immutability, or build locally then freeze)
  }
  return out;
}
```

### Ingredient resolution
```typescript
export type MatchStatus = 'have' | 'partial' | 'unitMismatch' | 'staple' | 'missing';
export interface IngredientMatch {
  name: string; needed: number; unit: string;
  have: number; status: MatchStatus; hasSubstitute: boolean; daysLeft: number | null;
}
```
`hasSubstitute` is computed by the engine via the substitution lookup (UI-SPEC requires it per missing ingredient) using a precomputed Set of table keys for O(1) checks, so ranking stays fast.

### Parity test (house pattern)
```typescript
// Source: frontend/lib/preferences/canonical.test.ts
const ROWS = JSON.parse(readFileSync(fileURLToPath(
  new URL('../../../backend/tests/fixtures/rules-cases.json', import.meta.url)), 'utf8'));
```

## Parity Strategy (client vs server consistency)

| Layer | Server | Client | Parity mechanism |
|-------|--------|--------|------------------|
| canonicalName | `intelligence/canonical.ts` | `lib/preferences/canonical.ts` | EXISTS (`canonical-cases.json`) |
| units/conversion | `intelligence/units.ts` | NEW `lib/rules/units.ts` | New fixture `unit-convert-cases.json` [input qty/unit -> base, family]; run in vitest AND backend jest (`tests/intelligence-units.test.ts` sibling) |
| diet filter | `ai/dietary-filter.ts` | NEW `lib/rules/diet.ts` | New fixture `diet-cases.json`; both runners. Do not edit server file (Phase 7 agent area); only add a new backend test file reading the fixture, or put the server-side assertion in a new file `backend/tests/rules-parity.test.ts` |
| expiring-use + name coverage | `rankCookFirst` | `rankRecipes` | Fixture `cook-first-cases.json` (recipes, pantry, staples, today): assert client `expiringUsed`, `coverage` (name-level mode) and the server's `usesExpiring/coveragePercent/score ordering` agree where semantics overlap. Client quantity-aware coverage is a deliberate superset, so parity is asserted with an engine option `quantityAware: false` or on fixtures where all quantities suffice |
| quantity-aware coverage | `subtractPantry` (shopping) | rank.ts | Cases where server `subtractPantry` reports full/partial/incompatible must map to have/partial/unitMismatch on the client |

Backend tests use jest (`jest --coverage`); frontend uses vitest. Fixtures live in `backend/tests/fixtures/` and the frontend already reads them by relative path. The "identical online vs offline" criterion is satisfied structurally: the engine has no data source branch; test by running the same fixture through the hook's pure core twice (with and without network mocks) and by deep-equality of outputs (determinism test).

## State of the Art
Rules-first, model-optional is the project's own recommendation (`.planning/research-v2/02-ondevice-ai.md`: "Do NOT make an LLM the foundation of offline"; "rules engine (always)" first in the capability router). Phase 13 will add on-device AI above this engine; keep the public API (`rankRecipes`, `findSubstitutes`) stable and JSON-serializable so a native/Swift layer or capability router can call it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Score weights (EXPIRY_POINTS 4, MISSING_PENALTY 6, coverage*100) are reasonable defaults | Pattern 3 | Product feel only; tune via fixtures |
| A2 | Culinary substitution ratios are correct from general knowledge | Pattern 4 | Bad advice in table; needs human review pass |
| A3 | Cross-family mismatch should count as "present, unknown quantity" not missing | Pattern 2 | Over-optimistic coverage; alternative is count as missing |
| A4 | Default pantry page size unverified (max 100 confirmed) | Pitfall 1 | Hook may under-fetch if default < 100 and loop is skipped |
| A5 | Perf: engine ~ low single-digit ms on desktop for 500x200; mid phone 5-10x slower | Validation | Measure in benchmark; budget 100 ms |
| A6 | `networkMode: 'offlineFirst'` + long gcTime is enough for Phase 9 offline demo without a persister | Pitfall 2 | If user expects cold-start offline, it needs Phase 11 |

## Open Questions

1. **Cross-family handling (A3).**
   - Known: server marks incompatible, does not convert (no density).
   - Unclear: product preference for ranking.
   - Recommendation: count as covered with status `unitMismatch`, shown in the "In your pantry" group as "have 1 kg (different unit)"; do not count toward `missing` pill. Planner/discuss confirms.
2. **Where do staples come from offline?** `prefs.stapleNames` / `defaultStapleNames` exist on `UserPreferences` (optional fields; old backends omit). Fallback: bundled copy of DEFAULT_STAPLE_NAMES guarded by a parity test against the backend constant (mirrors the schema/migration parity test noted in `staples.ts`).
3. **Does the user's diet preference live in `prefs.dietaryRestrictions` only?** Yes per type; Phase 7 may add consent/UI but the field is existing. Treat as read-only input.
4. **Persistence for cold-start offline** is Phase 11. Phase 9 acceptance should be worded as "engine and UI work with network off using cached data".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | vitest | yes | v24.9.0 | — |
| vitest | tests | yes | 5.0.3 | — |
| Network | none (feature must work without) | n/a | — | — |

No missing dependencies. No Xcode, no Capacitor.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.3 (frontend); jest 29 (backend, only for new parity-fixture test files) |
| Config file | `frontend/vitest.config.ts` (include `lib/**/*.test.ts`, node env, `@` alias) |
| Quick run command | `cd frontend && npx vitest run lib/rules` |
| Full suite command | `cd frontend && npm test` and `cd backend && npx jest tests/rules-parity.test.ts` |

Component tests: vitest include is `lib/**/*.test.ts` and env is node, so UI is verified by type-check, lint, and pure view-model helpers extracted into `lib/rules/` or `lib/hooks` (e.g. `buildRowViewModel`, `formatRatio`) that ARE unit-tested. Do not add jsdom/RTL in this phase unless planner chooses (would change vitest config; flag).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OFF-08 | Ranking by quantity-aware coverage, expiring boost, missing penalty, deterministic tie-breaks | unit | `npx vitest run lib/rules/rank.test.ts` | Wave 0 |
| OFF-08 | Explainability: have/partial/missing/expiringUsed + hasSubstitute | unit | `npx vitest run lib/rules/rank.test.ts` | Wave 0 |
| OFF-08 | Unit families/conversion parity with server | unit + parity | `npx vitest run lib/rules/units.test.ts` | Wave 0 |
| OFF-08 | Diet/exclusion filtering parity | unit + parity | `npx vitest run lib/rules/diet.test.ts` | Wave 0 |
| OFF-08 | Substitution lookup (exact, alias, token-subset), scaling, diet filter, in-pantry first, hidden count | unit | `npx vitest run lib/rules/substitutions.test.ts` | Wave 0 |
| OFF-08 | Substitution table integrity (zod schema, >=150 entries, unique keys, tags in allowed vocabulary, ratios positive) | unit | `npx vitest run lib/rules/substitutions-data.test.ts` | Wave 0 |
| OFF-08 | Perf: rank 500 recipes x 200 pantry items < 100 ms | benchmark-as-test | `npx vitest run lib/rules/rank.bench.test.ts` | Wave 0 |
| OFF-08 | Identical results online vs offline (determinism, no I/O): same inputs deep-equal; test with `fetch` stubbed to throw to prove no network call | unit | `npx vitest run lib/rules/determinism.test.ts` | Wave 0 |
| OFF-08 | Server parity: name-level coverage/expiring vs `rankCookFirst` on shared fixture | parity (both runners) | `npx vitest run lib/rules/parity.test.ts`; `cd backend && npx jest tests/rules-parity.test.ts` | Wave 0 |
| OFF-08 | UI wiring (route, nav title, entry points, states) | type-check + lint + manual offline check | `cd frontend && npm run type-check && npm run lint` | Wave 0 |

### Performance benchmark (100 ms budget)
Generate a seeded synthetic dataset (deterministic PRNG, no `Math.random`): 500 recipes x 6-14 ingredients drawn from a 300-name vocabulary with mixed units, pantry of 200 items (30% expiring within 7 days, some expired). Test: warm-up run, then median of 20 runs via `performance.now()`; assert median < 100 ms. Desktop is far faster than a mid phone, so use a tightened CI assertion (e.g. < 30 ms median, stated as ~3-5x safety margin for mid-phone) and log the number. Also measure the substitution `hasSubstitute` precompute separately. Keep the benchmark in the normal suite (fast, <1 s) so regressions fail CI. To approximate a mid phone locally, run with `node --cpu-prof` is unnecessary; the margin approach is sufficient. [ASSUMED: 3-5x mid-phone slowdown factor]

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run lib/rules`
- **Per wave merge:** `cd frontend && npm test && npm run type-check && npm run lint`
- **Phase gate:** full frontend suite + new backend parity test green before `/gsd:verify-work`; coverage for `lib/rules` >= 80% (`npx vitest run --coverage` requires `@vitest/coverage-v8`; check if installed, else flag and do not add silently).

### Wave 0 Gaps
- [ ] `frontend/lib/rules/*.test.ts` (rank, units, diet, substitutions, substitutions-data, determinism, parity, rank.bench)
- [ ] Shared fixtures in `backend/tests/fixtures/` : `unit-convert-cases.json`, `diet-cases.json`, `cook-first-cases.json`
- [ ] `backend/tests/rules-parity.test.ts` (new file; imports server `rankCookFirst`, `dietary-filter`, `units`)
- [ ] Seeded dataset generator helper in `frontend/lib/rules/test-helpers.ts`
- [ ] Coverage provider availability check

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | Feature is read-only over already-authenticated cache; no new endpoints |
| V4 Access Control | no | No server access added |
| V5 Input Validation | yes | Validate/normalize cached recipe/pantry shapes at the hook boundary (house `normalize*` pattern; zod available); static JSON validated in a test |
| V6 Cryptography | no | none |
| V8 Data Protection | yes (light) | No data leaves device; no analytics events containing pantry contents; do not log pantry/recipes |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/huge cached data causing slow ranking or crashes | DoS | Caps (500 recipes, 2000 pantry, ingredient name length 200 as in canonicalName), total functions that never throw |
| ReDoS via diet free-text regex (server `termPattern` builds RegExp from user text) | DoS | Port escapes via `escapeRegex`; cap restriction count/length; compile patterns once per run, not per recipe |
| Misleading allergy advice | Info/Safety | Mandatory disclaimer copy from UI-SPEC; keep "keyword check, not a medical guarantee" |
| XSS via recipe text | Tampering | Render as React text only; never `dangerouslySetInnerHTML` |

## Sources

### Primary (HIGH confidence, codebase read this session)
- `backend/src/modules/intelligence/{cook-first,cook-first.service,pantry-subtract,units,staples,quantity}.ts`
- `backend/src/modules/ai/dietary-filter.ts`, `ai/features/{substitutions,apply-dietary}.ts`
- `frontend/lib/{recipes/cook-first.ts,preferences/canonical.ts,preferences/staples.ts,pantry/{expiry,quantity}.ts,cook/preview.ts,react-query.ts,hooks/use-pantry.ts,api/recipes.ts}`, `frontend/vitest.config.ts`, `frontend/types/*.ts`, `components/ai/diet-filter-notice.tsx`
- `.planning/phases/09-offline-rules-engine/{09-CONTEXT,09-UI-SPEC}.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/research-v2/02-ondevice-ai.md`

### Secondary / Tertiary
- None; no external documentation needed (no new libraries).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all verified in repo
- Architecture: HIGH - mirrors existing server design and client conventions
- Pitfalls: MEDIUM-HIGH - pagination/page-size default and cache lifetime derived from code reading, not run
- Substitution table content: MEDIUM-LOW (A2) - needs human review

**Research date:** 2026-10-10
**Valid until:** 30 days (stable internal code)
