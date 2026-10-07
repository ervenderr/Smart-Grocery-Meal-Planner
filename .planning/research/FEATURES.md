# Feature Research

**Domain:** Pantry + meal planner + shopping list + budget app (mobile-first PWA), subsequent milestone (gap analysis)
**Researched:** 2026-10-08
**Confidence:** MEDIUM (competitor feature sets and HN themes are well sourced; Reddit and app-store review text could NOT be fetched directly, so "what users complain about" leans on HN comments, vendor community forums, review sites and listings. Treat Reddit/app-store claims as unverified.)

## Evidence Limits (read first)

- Reddit is blocked to the fetch tool and WebSearch returned no Reddit threads. No r/MealPrepSunday, r/EatCheapAndHealthy, r/mealplanning, or r/selfhosted quotes are cited. Do not cite them as sources.
- Hacker News was mined via the public Algolia API (real comments, objectIDs below). Mealime's community forum, Plan to Eat's help center, Open Food Facts docs, caniuse, and npm were read directly.
- App-store review counts were not retrievable; ratings are from aggregator pages (LOW).
- Yummly shut down 2024-12-20 with no bulk export (MEDIUM, vendor blog plus aggregator). This is the strongest "data lock-in" story in the category.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent, server-backed shopping list with check-off | Every competitor (Cozi, Plan to Eat, Samsung Food, Paprika) has it; Cozi's "instant sync" is its praised feature | LOW-MED | Kitcha has the DB model + `shopping.ts` client but UI uses `sessionStorage` (see gap G1) |
| Manual add/edit/delete of list items | Lists are used for non-recipe items (toilet paper) | LOW | Needs backend `shopping-lists` routes |
| Merge duplicate ingredients across recipes | Samsung Food "combines ingredients from multiple recipes"; Plan to Eat merges same title + unit | MED | Kitcha merges only on exact `name:unit` key |
| Unit conversion / normalization (cups, oz, g, ml) | HN 46148469: "Unit Conversion: A highly-requested feature"; Plan to Eat groups mismatched units on one line | MED | Needs ingredient parsing into qty/unit/item at save time (newly.app guidance); `parse-ingredient` 3.0.0, `convert-units` 2.3.4 on npm |
| Group shopping list by aisle/category | Paprika, Plan to Eat (store then category), Shopping Sorted; Mealie users complain list is only alphabetical (Galaxus review); HN asdfgeoff 21238982 praises rearrangeable aisles | LOW | Kitcha already stores `category`; just group in UI |
| Subtract pantry stock from generated list | HN dllthomas 8269626 "meal planners need to be integrated with pantry management"; HN itsthejb 32325257 praises planning around what's left | MED | Depends on unit normalization. Kitcha's list generator ignores the pantry (confirmed in `mealplan.service.ts`) |
| Exclude/mark "staples" (salt, oil) | HN 46152452 and 27182818284 "check off the general staples"; PlateJoy only replenishes cinnamon/olive oil "when you need it" (12160429) | LOW | Boolean `isStaple` on pantry item or a per-user staples list |
| Recipe import from URL | Paprika, Plan to Eat clipper, Mealie (300+ sites), Samsung Food | MED | schema.org JSON-LD parse server-side; `recipe-scrapers-js` 1.0.0 exists (young, verify). Kitcha has only manual entry + AI |
| Recipe scaling by servings | Samsung Food reviewers praise it; Kitcha has servings but verify UI | LOW | Multiplier already used in backend list generation |
| Bottom nav, thumb-sized targets, quick add | Core value of this milestone; competitors are native-mobile-first | LOW-MED | Kitcha is sidebar + hamburger today |
| Expiry visibility on pantry (color, sorted by soonest, 3/7-day) | Core of NoWaste/KitchenPal | LOW | Exists (7-day banner); add sort-by-expiry and "use first" |
| Data export/backup | Yummly shutdown with no bulk export; HN kjellsbells 31201858 "bulk import and export would be a great feature" | LOW | `data-settings.tsx` exists; verify it exports recipes + pantry as JSON/CSV |
| Offline-capable shopping list | In a store with bad signal; HN packet_nerd 28686872 wants it to work without cloud | MED | PWA cache + IndexedDB queue (`serwist` 9.5.x, `idb-keyval` 6.3.0) |
| Empty states + first-run guidance | Standard SaaS expectation | LOW | `EmptyState` component exists but is used in few places; no onboarding |

### Differentiators (Competitive Advantage)

Aligned with Kitcha's core value: "see what I have, what to cook, what to buy, without wasting food or money."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Cook this to use what's expiring" (expiry-ranked recipe match from OWN recipes first, AI second) | HN gnarlouse 45225181 wishes for plans that "reuse ingredients nearing expiration"; Mealime forum asks for swaps that share ingredients to cut waste. Paprika/Plan to Eat do NOT do pantry-aware planning (FoodiePrep, vendor source, LOW) | MED | Deterministic scoring (matched ingredients, expiry urgency) needs no LLM; reduces AI cost. Depends on ingredient normalization |
| Low-friction pantry capture: barcode scan to add (Open Food Facts) | Manual entry is THE abandonment reason (HN 32317939, foodandnutrition review of Prep & Pantry). Scanner "has to work in milliseconds" (HN 26360297) | MED | `barcode-detector` 3.2.2 (zxing-wasm polyfill); native BarcodeDetector is disabled by default on iOS Safari per caniuse (MEDIUM). OFF limits: 15 req/min product reads/IP, custom User-Agent required, ODbL attribution; server-side cache allowed |
| "Bought it" flow: checking off a shopping item offers to add it to pantry (with default shelf life) | Closes the loop Pantry -> Buy list -> Cart -> Pantry (HN jldugger 35703673). Removes double entry | MED | Needs persistent list (G1). Default expiry by category lookup table |
| "Cooked it" flow: deduct recipe ingredients from pantry in one tap | Keeps inventory honest without logging each use | MED | Needs ingredient normalization; allow "skip/adjust" because estimates are imperfect |
| Budget awareness inside planning: price per list, estimated vs actual | Kitcha already has budget, market prices, `actualCostCents`. Few competitors combine planner + budget | LOW-MED | Surface estimate-vs-actual on list completion |
| Household sharing (shared pantry + list, 2-5 people) | HN joshstrange 19301594: shared-household pantry is hard because everyone must log; yieldcrv 34225248 says list-sharing apps serve tiny groups; Cozi and Plan to Eat sell sharing | HIGH | Requires household entity and data ownership migration (`userId` -> `householdId`). Highest-effort item; defer |
| Quick "restock" check before shopping instead of continuous logging | HN jldugger 22648606: "data entry is simpler if you only check before planned grocery store runs" | LOW | A pre-shop "do you still have X?" checklist on list generation |
| Shopping mode (big targets, checked items sink, wake lock, aisle groups) | In-store use is the product's core moment | LOW | Screen Wake Lock API, simple |
| Leftover/"use-up" nudges via existing notifications + Zapier | Already built plumbing; add expiry-to-recipe link in notification | LOW | |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Receipt OCR / photo-of-fridge AI inventory | PantryAI-style marketing; solves manual entry | Needs vision-LLM calls or paid OCR; error-prone (HN ThunderSizzle 47835659: digitization "error prone"); free-tier quota risk | Barcode + "bought it" flow + staples list |
| Grocery store delivery/ordering integrations | Plan to Eat / Walmart-style | Partner APIs, regional (Kitcha uses PHP currency), legal burden | Export list as text / copy to clipboard / share sheet |
| Native iOS/Android app | "Real app" feel | Already Out of Scope in PROJECT.md | Installable PWA |
| Full calorie/macro diary (MyFitnessPal-style) | Mealime forum request | Scope explosion; accuracy disputes | Keep per-recipe nutrition; defer logging |
| Public recipe social network / comments / follows | Public sharing exists | Moderation, abuse, storage | Keep link-sharing of single recipes |
| Real-time multi-user live sync (websockets/CRDT) | Cozi "instant sync" | Complexity for 2-5 users | Polling on focus + optimistic updates via React Query |
| Per-item continuous stock tracking (weigh/consume every use) | "Perfect inventory" | This is exactly what causes abandonment (HN 32317939, eddythompson80 47025191 on over-engineered trackers) | Coarse status (have/low/out) + expiry only for perishables |
| Voice assistant integrations (Google Home) | Mealime forum request | Platform review, fragile | Not now |
| Paywalls/ads | Competitor revenue (Samsung Food Food+ $59.99/yr; Cozi Gold ads) | Complaints about ads and gated cook mode (Android Authority) are a documented competitor weakness | Stay free; free tiers only |
| Mandatory expiry date on every pantry item | Completeness | Prep & Pantry review: data-entry burden; allow skipping | Optional expiry with category default |

## Feature Dependencies

```
Persistent shopping list (G1)
    ├──requires──> backend shopping-list routes (client already exists)
    ├──enables──> Manual add / check-off persistence / history
    ├──enables──> Offline shopping mode (needs server state to cache)
    └──enables──> "Bought it -> add to pantry" flow

Ingredient parsing/normalization (qty, unit, item, canonical name)
    ├──requires──> Unit conversion table (mass/volume, plus piece-weight for few items)
    ├──enables──> Merge across recipes (accurate)
    ├──enables──> Subtract pantry from list
    ├──enables──> Expiry-ranked recipe match
    └──enables──> "Cooked it" pantry deduction

Barcode scan ──requires──> Open Food Facts proxy+cache endpoint (backend), camera permission UX (HTTPS, PWA)
Barcode scan ──enhances──> Add-pantry quick flow

Bottom nav / quick-add FAB ──enhances──> every capture flow (do before barcode)

Household sharing ──requires──> householdId migration of pantry/list/recipes/plans ──conflicts──> doing it mid-way through other schema changes (do last or not at all)

Onboarding ──requires──> empty states + sample data / starter staples
```

### Dependency Notes

- **Normalization is the keystone.** Five of the highest-value features sit on it. Build once, with a canonical-name + unit schema, and test it hard (80% coverage rule).
- **Persistent list before offline.** Offline queue needs a server model to sync to.
- **Household sharing conflicts with schema churn.** It re-keys every table; schedule it last.

## Kitcha Audit (what the code shows)

Verified by reading `frontend/app/(app)/*`, `frontend/components/*`, `backend/prisma/schema.prisma`, `backend/src/modules/mealplan/mealplan.service.ts`.

| Area | Finding | Evidence |
|------|---------|----------|
| Shopping list persistence | Generated list lives in `sessionStorage`; checkboxes are uncontrolled and lost on reload; page does `window.location.reload()` after generate; no manual add | `app/(app)/shopping/page.tsx` |
| Shopping backend | `ShoppingList`/`ShoppingListItem` models exist and `lib/api/shopping.ts` client exists (comment says endpoint "may not be implemented"); no `shopping` module in `backend/src/modules`; client is never imported | schema.prisma, `lib/api/shopping.ts` |
| List generation | Aggregates by `name:unit`; no unit conversion, no pantry subtraction, no category, no staples | `mealplan.service.ts` ~L570-600 |
| Navigation | Left sidebar with hamburger drawer; 8 items; no bottom nav, no quick-add | `dashboard-sidebar.tsx`, `(app)/layout.tsx` |
| PWA | No manifest, no service worker, no offline (grep found nothing) | frontend root |
| Barcode | README says "Coming soon"; no code | README, grep |
| Onboarding | None. `EmptyState` component exists but is referenced from only one file; pages hand-roll empty states | grep |
| Expiry | 7-day banner in pantry page; notifications/alerts exist. No "what can I cook with this" link from expiring items | `pantry/page.tsx` |
| Pantry units | Fixed unit select; unit is free string in DB; no canonical ingredient name | `add-pantry-item-modal.tsx`, schema |
| Recipe input | Manual form + AI suggestions only; no URL import, no photo | `add-recipe-modal.tsx` |
| AI suggestions | Pantry-based modal exists ("N pantry items analyzed") but not ranked by expiry; all LLM-driven | `ai-recipe-suggestions-modal.tsx` |
| Household | Everything `userId`-scoped; no sharing | schema.prisma |
| Currency | Hard-coded peso symbol in shopping page | `shopping/page.tsx` |
| Large files | `add-recipe-modal` 497 lines, `edit-recipe-modal` 512, `ai-meal-plan-modal` 401 (OK under 800 but heavy modals are poor on mobile) | wc -l |
| Dashboard | Uses `Promise.all` with `.catch` fallbacks (good); no "today's meal / expiring / low stock" action cards verified | `dashboard/page.tsx` |

## Kitcha Gap List (prioritized: user value vs effort)

| ID | Gap | User Value | Effort | Priority | Sources |
|----|-----|------------|--------|----------|---------|
| G1 | Persistent shopping list (backend CRUD + UI wired to it, manual add, persisted check-off, complete trip -> history) | HIGH | LOW-MED | P1 | Audit; Cozi instant sync praise; table stakes in all competitors |
| G2 | Mobile shell: bottom nav (Pantry, Recipes, Plan, Shop, More), FAB quick-add, full-screen sheets instead of centered modals | HIGH | MED | P1 | PROJECT.md core value; competitors are mobile-first |
| G3 | PWA install + offline shell + offline shopping list read/check-off | HIGH | MED | P1 | HN packet_nerd 28686872; in-store signal |
| G4 | Shopping list grouped by category/aisle + checked items sink + wake lock ("shopping mode") | HIGH | LOW | P1 | Galaxus Mealie review; Paprika/Plan to Eat; HN asdfgeoff 21238982 |
| G5 | Ingredient normalization + unit conversion + merge fix | HIGH | MED-HIGH | P1 | HN 46148469; newly.app; Plan to Eat docs |
| G6 | Subtract pantry from list; staples list | HIGH | MED (after G5) | P1 | HN 8269626, 32325257, 27182818284, 12160429 |
| G7 | Expiry-driven "cook this first" recipe ranking (own recipes, deterministic) + link from expiring banner/notification | HIGH | MED (after G5) | P1 | HN 45225181; Mealime forum; competitor gap |
| G8 | Onboarding (3-step: set preferences/currency, add staples, add first items or sample recipes) + empty states on every page | MED-HIGH | LOW | P2 | Audit |
| G9 | Barcode scan to add pantry item (OFF via backend cache, manual fallback always) | HIGH | MED | P2 | HN 32317939, 26360297; Pantry Manager reviews note inconsistent scanning, so keep manual path fast |
| G10 | Recipe import from URL (JSON-LD) | MED-HIGH | MED | P2 | Paprika/Plan to Eat/Mealie; Samsung Food extension complaints show demand and failure risk |
| G11 | "Bought it" -> add to pantry with category-default expiry; "Cooked it" -> deduct | MED-HIGH | MED | P2 | HN jldugger 35703673 |
| G12 | Pantry quick-edit: optional expiry, sort by soonest, "have/low/out" status, swipe actions | MED | LOW | P2 | Prep & Pantry review |
| G13 | Estimate vs actual spend on trip completion feeding budget | MED | LOW | P2 | Existing schema fields unused by UI |
| G14 | Configurable currency (remove hard-coded peso) | MED | LOW | P2 | Audit |
| G15 | Data export (JSON/CSV) verified + recipe import of Kitcha export | MED | LOW | P3 | Yummly shutdown; HN 31201858 |
| G16 | Recipe ratings/notes ("what I changed") | LOW-MED | LOW | P3 | Mealime forum |
| G17 | Household sharing (shared pantry + list) | MED-HIGH | HIGH | P3 / defer | HN 19301594, 34225248 |
| G18 | Multiple named shopping lists | LOW-MED | LOW | P3 | HN kjellsbells 31201858 |

## MVP Definition

### Launch With (this milestone, v1)

- [ ] G1 persistent shopping list: everything else in shopping depends on it
- [ ] G2 mobile shell + G3 PWA/offline shell: stated milestone goal
- [ ] G4 shopping mode: cheap, high in-store payoff
- [ ] G5 + G6 normalization, merge, pantry subtraction, staples: fixes the most-cited list pain
- [ ] G7 expiry-driven recipe ranking: Kitcha's real differentiator, and it can be deterministic (saves AI quota)
- [ ] G8 onboarding + empty states

### Add After Validation (v1.x)

- [ ] G9 barcode scan: once normalization exists, scanned names map to canonical items
- [ ] G10 URL recipe import
- [ ] G11 bought-it / cooked-it loops
- [ ] G12-G14 polish

### Future Consideration (v2+)

- [ ] G17 household sharing: re-keys the schema; only if a second real user appears
- [ ] Receipt OCR: only if a free vision option proves reliable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persistent shopping list (G1) | HIGH | LOW-MED | P1 |
| Bottom nav + quick add (G2) | HIGH | MED | P1 |
| PWA + offline list (G3) | HIGH | MED | P1 |
| Aisle grouping + shopping mode (G4) | HIGH | LOW | P1 |
| Normalization + units (G5) | HIGH | MED-HIGH | P1 |
| Pantry subtraction + staples (G6) | HIGH | MED | P1 |
| Expiry-ranked recipes (G7) | HIGH | MED | P1 |
| Onboarding/empty states (G8) | MED-HIGH | LOW | P2 |
| Barcode scan (G9) | HIGH | MED | P2 |
| URL import (G10) | MED-HIGH | MED | P2 |
| Bought/Cooked loops (G11) | MED-HIGH | MED | P2 |
| Household sharing (G17) | MED-HIGH | HIGH | P3 |

## Competitor Feature Analysis

| Feature | Mealime | Paprika | Plan to Eat | Samsung Food | KitchenPal / NoWaste | Cozi | Kitcha today | Our approach |
|---------|---------|---------|-------------|--------------|----------------------|------|--------------|--------------|
| Shopping list merge | Yes | Yes, aisle-sorted | Merge same title+unit; groups mixed units | Combines across recipes | Basic | Basic, instant sync | Name:unit only, not persisted | G1, G5 |
| Pantry-aware list | No | No | No (per FoodiePrep, LOW) | Limited | Core (inventory) | No | Not subtracted | G6 |
| Expiry tracking | No | No | No | Limited | Core | No | Yes | Keep + G7 |
| Recipe URL import | Own library | Strong clipper | Clipper | Yes (extension rated 3.5) | No | No | No | G10 |
| Barcode scan | No | No | No | No | Yes (KitchenPal free tier 100 items in 2023 source; NoWaste free 500 items / 6 lists) | No | Not built | G9 |
| Household sharing | Limited | Sync | Shared calendar | Yes | NoWaste/KitchenPal lists | Core | None | Defer |
| Budget | No | No | No | No | Little | No | Yes (strength) | Surface in planning |
| Pricing/paywall | Favorites in plans paywalled (Mealime forum) | One-time paid | Paid | Food+ $59.99/yr; ads | Freemium item caps | Ads / Gold | Free | Stay free |
| Offline | Native | Native | Web+app | Native | Native | Native | None | PWA |

## Sources

- Mealime community "What would make Mealime better for you?" https://community.mealime.com/t/what-would-make-mealime-better-for-you/28 (2016 thread; MEDIUM) and iPhone Life review https://iphonelife.com/content/mealime-pro-review-perfect-recipe-app-busy-professionals (MEDIUM)
- Hacker News via Algolia API (MEDIUM, real comments): objectIDs 8269626, 12160429, 19301594, 22648606, 26360297, 28686872, 32317939, 35703673, 38833057, 45225181, 47025191, 47835659, 31201858, 34225248, 21238982, 46148469, 46152452
- Plan to Eat shopping-list sorting/merging help https://learn.plantoeat.com/help/sort-group-and-combine-items-on-your-shopping-list (HIGH for that product's behavior)
- Yummly closure: https://www.plantoeat.com/blog/2024/12/yummly-is-closing-discover-the-best-meal-planning-alternative (vendor blog; MEDIUM)
- Samsung Food review and paywall: Android Authority https://www.androidauthority.com/samsung-food-3517054/ (MEDIUM)
- Pantry app abandonment: Prep & Pantry review https://foodandnutrition.org/january-february-2014/prep-pantry-lite-version-3-4-01/ (2014, LOW-MED); Pantry Manager report https://marlvel.ai/apps/pantry-manager (LOW)
- NoWaste listing https://apps.apple.com/app/id926211004 ; KitchenPal "What the Tech" https://www.wrdw.com/2023/10/09/what-tech-use-app-day-keep-food-inventory (limits may be outdated; LOW)
- Mealie aisle-sort complaint (Galaxus/Digitec review) https://www.galaxus.ch/en/page/digitalization-in-the-kitchen-without-mealie-i-would-starve-43165 (MEDIUM)
- Ingredient parsing/merge pitfalls https://newly.app/build/meal-planner-grocery-list-app (vendor; LOW-MED)
- Barcode: caniuse BarcodeDetector https://caniuse.com/mdn-api_barcodedetector (MEDIUM; confirm before build); npm `barcode-detector` 3.2.2, `parse-ingredient` 3.0.0, `convert-units` 2.3.4, `serwist` 9.5.13, `idb-keyval` 6.3.0 (HIGH, npm registry queried 2026-10-08)
- Open Food Facts API rules https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ and https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api (HIGH for limits; 15/min product reads, 10/min search per IP, custom User-Agent, ODbL attribution)
- Kitcha code audit (HIGH): files listed in "Kitcha Audit" table

---
*Feature research for: pantry + meal planner + shopping list + budget PWA*
*Researched: 2026-10-08*
