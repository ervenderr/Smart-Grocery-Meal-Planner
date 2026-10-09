# Phase 6: Capture Loops - Research

**Researched:** 2026-10-09
**Domain:** Barcode capture (browser camera + Open Food Facts), pantry mutation flows (bought it, cooked it, quick edit) on Express/Prisma/Next.js
**Confidence:** HIGH on codebase facts, MEDIUM on iOS camera/polyfill behavior (needs a real-iPhone check)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Barcode scan (CAP-01, CAP-02)**
- Scanner: native `BarcodeDetector` where available, else the `barcode-detector` (ZXing-WASM) polyfill for iOS; lazy-loaded only on the scan screen (per STACK.md; verify on a real iPhone as a deferrable checkpoint).
- Entry points: a "Scan" button in the Add Pantry modal and a camera icon in the pantry page header; opens a full-screen camera sheet and prefills the add form on a hit.
- Failure, permission denied or unknown product: fall back to the manual form with the barcode kept, plus a "type the barcode" field. Nothing blocks the user.
- Storage: new nullable `PantryItem.barcode` column via an additive migration (never touch applied migrations); shown on the edit form and used to prefill repeat scans.
- Open Food Facts requests keep the required `User-Agent`; each product is cached in Postgres (reuse the existing backend `food` module and `frontend/components/food/barcode-lookup.tsx`).

**Bought it and Cooked it (CAP-03, CAP-04)**
- Bought it: the finish-shopping sheet gets an opt-in "Add checked items to pantry" toggle, on by default. No mid-aisle prompt on check-off.
- Bought-it merge: merge into an existing non-expired pantry item with the same canonical name and unit family (Phase 5 helpers); otherwise create a new item with category from `inferCategory`, purchase date and price from the list item.
- Cooked it: a "Cooked it" button on recipe detail and on a meal-plan item showing a preview of deductions (item, have, use, left) that the user can confirm or edit before applying.
- Deduction rules: scale by servings; subtract within unit families only (never across families); floor at 0; delete nothing (zero-quantity items stay, flagged "used up"); ingredients not in the pantry are skipped and listed; staples are not deducted; a meal-plan item is marked cooked once so it cannot be applied twice.

**Pantry quick-edit and delivery (CAP-05)**
- Quantity +/-: stepper on each pantry card (44px targets) with a smart step per unit (pieces 1, g 50, kg 0.25, ml 50, etc.), optimistic and debounced with rollback on error; tapping the number allows direct entry.
- Expiry: tapping the expiry chip opens a small bottom sheet with a date input and +1d/+3d/+7d/clear shortcuts.
- Backend: reuse `PATCH /pantry/:id` if it supports partial updates, else add a lean one. Quantity never below 0; 0 shows a "used up" state with one-tap remove.
- Delivery: as in Phases 4 and 5: additive migration and backend first (Railway, extend `scripts/smoke-prod.sh` with its own smoke user), then push the frontend to main (Vercel). CI stays green. Real-phone camera test is a final deferrable human checkpoint.

### Claude's Discretion
Module and file names, exact step sizes, sheet component structure, endpoint naming, plan splitting and waves.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | Scan barcode (library fallback on iOS) to prefill pantry item from OFF | `GET /api/v1/food/barcode/:code` already exists, cached 30d; `barcode-detector` ponyfill lazy-load; capability probe via `getSupportedFormats()`; repeat-scan prefill via new `barcode` column + list filter |
| CAP-02 | On scan failure/denied/unknown, manual entry with barcode kept | Food endpoint returns 404 `LOOKUP_NOT_FOUND`, 429 `LOOKUP_THROTTLED`, 503 `LOOKUP_UNAVAILABLE`; scan state machine maps each to the UI-SPEC states; create/update accept `barcode` |
| CAP-03 | Checked shopping item can be added to pantry | Extend `POST /shopping/finish` with `addToPantry`; merge via `canonicalName` + `resolveUnit`/`familyKey`; unit coercion to `PantryUnit` |
| CAP-04 | Cooked recipe/meal deducts ingredients | New `cook` module (preview + apply), reuses `aggregateGroups`, staples, units; `MealPlanItem.cookedAt` column with race-safe conditional update |
| CAP-05 | Quick-edit quantity and expiry from list | `PATCH /pantry/:id` already partial but rejects quantity 0 (must relax); stepper/expiry helpers in `frontend/lib/pantry` |
</phase_requirements>

## Summary

Most of the backend plumbing already exists. The OFF client, 30-day Postgres cache (via `AiCache` helpers), throttle, and the `GET /food/barcode/:code` route are done, and Phase 5 left reusable pure helpers (`canonicalName`, `resolveUnit`, `familyKey`, `toBase`/`fromBase`, `aggregateGroups`, `resolveStaples`/`filterStaples`). The real work is: (1) two additive columns (`pantry_items.barcode`, `meal_plan_items.cooked_at`), (2) relaxing the pantry PATCH to allow quantity 0, (3) a new `cook` backend module plus an `addToPantry` extension of the finish endpoint, and (4) a lot of frontend UI (scan sheet, stepper, expiry sheet, cook sheet, finish toggle).

Four codebase facts the planner must design around: (a) the pantry page (`app/(app)/pantry/page.tsx`) uses raw `useState` + `pantryApi`, NOT React Query, so optimistic stepper updates need either a page migration to `useQuery`/`useMutation` (recommended; `queryKeys.pantry` already exists) or local-state rollback; (b) `PATCH /meal-plans/:id` with `meals` does `deleteMany` + recreate, which would erase any `cookedAt` marker unless carried forward; (c) `PantryUnit` is a closed 12-value enum (grams, kg, oz, lbs, ml, liters, tsp, tbsp, fl_oz, cups, pieces, items), so UI-SPEC step-size names like `g`, `l`, `cup`, `can` must be mapped to these actual values; (d) shopping list units are free text (`can`, `bunch`), so "bought it" must coerce to a valid `PantryUnit` or the edit form's select cannot display the item.

**Primary recommendation:** Ship backend first as three slices (migration + pantry changes; cook module; finish `addToPantry`) with Jest/supertest coverage and a new smoke check 14, deploy to Railway, then build frontend slices (stepper/expiry, scan, finish toggle, cook sheet) and push to main.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera stream + barcode decode | Browser / Client | — | getUserMedia and WASM decode are browser-only |
| Barcode to product lookup + cache | API / Backend | Database (AiCache) | Existing `food` module owns OFF User-Agent, throttle, cache |
| Repeat-scan prefill | API / Backend (list filter by `barcode`) | Browser | User-scoped DB query |
| Quantity/expiry quick edit | API / Backend (PATCH validation, floor 0) | Browser (optimistic, debounce) | Server enforces invariants; client owns UX latency |
| Bought-it merge | API / Backend (inside finish flow) | — | Needs canonical/unit-family logic (server-only helpers) and atomicity |
| Cook preview math | API / Backend | Browser (display, live "Left" recompute) | Reuses server Decimal math, staples, unit conversion |
| Cook apply + once-only guard | API / Backend / Database | — | Race-safe conditional update on `cooked_at` |
| Step size / formatting / date shortcuts | Browser (pure helpers in `lib/`) | — | Presentation logic, Vitest-testable |

## Standard Stack

### Core (all already installed unless noted)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express-validator | existing | Request validation | Established pattern in every module |
| Prisma | 5.22.x (stay) | Migration + queries; `$transaction` | Locked by STACK.md |
| `Decimal` clone `D` from `intelligence/quantity.ts` | existing | Exact quantity math | Phase 5 rule: sum in base, round once |
| @tanstack/react-query | ^5.90.8 | Optimistic updates, mutation scope | Used by shopping hooks |
| react-hot-toast | existing | Toasts (incl. Undo action) | Used across pantry/shopping |
| lucide-react | ^0.553.0 | Icons (`ScanBarcode`, `Flashlight`, `CameraOff`, `PackageX`, `ChefHat`...) | Per UI-SPEC |
| `barcode-detector` | 3.2.2 (new, frontend) | Standards-based `BarcodeDetector` ponyfill over ZXing-WASM | Locked decision; MIT, depends on `zxing-wasm` 3.1.3 [VERIFIED: npm registry; STACK.md] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `barcode-detector` | `@zxing/browser`, `html5-qrcode` | Locked decision already chose `barcode-detector`; do not revisit |
| New `cook` module | Put routes in `recipe`/`mealplan` | Both files are large (mealplan.service is 805 lines, over the 800 cap). Use a new module. |

**Installation (frontend only):**
```bash
cd frontend && npm install barcode-detector@3.2.2
```

**Version verification:** `npm view barcode-detector version` -> 3.2.2 (modified 2026-08-16); license MIT; dependency `zxing-wasm` 3.1.3 (registry latest of zxing-wasm is 3.1.5); no `postinstall` script reported. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| barcode-detector | npm | since 2021-03 (5+ yrs) | not checked | github.com/Sec-ant/barcode-detector | unavailable (no pip in env) | [ASSUMED] legitimacy; named in STACK.md and the maintainer's GitHub README. Planner: add a `checkpoint:human-verify` before install (confirm repo/maintainer `sec-ant`). |
| zxing-wasm (transitive) | npm | n/a | n/a | github.com/Sec-ant/zxing-wasm | unavailable | transitive of the above, same maintainer |

**Packages removed:** none. **Packages flagged [SUS]:** none (slopcheck could not run; all tagged [ASSUMED] per protocol). No other new packages are needed: backend uses existing `zod`, `express-validator`, Prisma.

## Architecture Patterns

### System Architecture Diagram

```
 CAMERA PATH (CAP-01/02)
 Pantry header "Scan" / Add modal "Scan"
        |
        v
 ScanSheet (Radix Dialog) --getUserMedia--> <video> --rAF/200ms loop--> BarcodeDetector.detect()
        |   (native if getSupportedFormats() has ean_13; else dynamic import('barcode-detector/ponyfill'))
        |-- denied / unsupported / no camera ---------------------------+
        |-- user taps "Type the barcode" ----> ManualBarcodeForm -------+
        v                                                                v
 first detection (debounced) --> normalizeBarcode --> [GET /pantry?barcode=X] hit? --> prefill from own item + banner
                                                    \-> GET /food/barcode/X --> 200: prefill (OFF, attribution)
                                                                            --> 404: "unknown" card ----+
                                                                            --> 429/503: "failed" card -+--> Add modal (barcode kept)

 BOUGHT IT (CAP-03)
 FinishSheet toggle(addToPantry=true) --> POST /shopping/finish {carryOver, receiptDate, addToPantry}
   tx1: complete list, history row, carry-over; return checked items
   after commit (try/catch): load user pantry -> per checked item: merge (same canonical + unit family, non-expired)
                             or create (category/unit coerced) -> { added, merged, failed }

 COOKED IT (CAP-04)
 Recipe detail / meal-plan item --> POST /cook/preview {recipeId, servings, mealPlanItemId?}
   aggregateGroups(scaled) -> filterStaples -> match pantry lots (non-expired, same family, FEFO) -> rows + notes
 user edits "Use" --> POST /cook/apply {recipeId|mealPlanItemId, servings, deductions[{pantryItemId, use}]}
   tx: conditional updateMany(cookedAt null->now) (409 ALREADY_COOKED if 0 rows)
       re-read lots (ownership), clamp use<=have, quantity = max(have-use,0), no deletes

 QUICK EDIT (CAP-05)
 Stepper (+/-, debounce 400ms) --> PATCH /pantry/:id {quantity}   (0 allowed)
 Expiry chip --> ExpirySheet --> PATCH /pantry/:id {expiryDate: 'YYYY-MM-DD' | null}
```

### Recommended Project Structure
```
backend/src/modules/
  pantry/            # + barcode field, quantity>=0 on PATCH, ?barcode= list filter
  cook/              # NEW
    cook.plan.ts       # pure: computeCookPlan(...) -> rows/notes (no clock, no DB)
    cook.service.ts    # preview() + apply() (DB)
    cook.controller.ts, cook.routes.ts, cook.validation.ts
  shopping/
    shopping-pantry.ts # NEW pure: planPantryMerge(checkedItems, pantryLots, today)
    shopping-finish.service.ts  # + addToPantry orchestration
  mealplan/          # + cookedAt in response; carry cookedAt across PATCH meals replace
backend/prisma/migrations/20261013000000_capture_loops/migration.sql
backend/tests/ pantry-capture.test.ts, cook-plan.test.ts, cook-endpoints.test.ts,
               shopping-finish-pantry.test.ts, mealplan-cooked.test.ts

frontend/lib/scan/        barcode.ts (+test), use-barcode-scanner.ts
frontend/lib/pantry/      quantity.ts (+test), expiry.ts (EXISTS: extend with addDays/shortcut helper + tests)
frontend/lib/cook/        preview.ts (live "Left"/clamp math, +test)
frontend/lib/api/         cook.ts (new), pantry.ts (+barcode), shopping.ts (+addToPantry)
frontend/components/pantry/scan|cook/ ... (per UI-SPEC Component Inventory)
```

### Pattern 1: Additive migration
Latest migration is `20261012000000_user_staple_names`. Add `20261013000000_capture_loops`:
```sql
ALTER TABLE "pantry_items" ADD COLUMN "barcode" TEXT;
CREATE INDEX "pantry_items_user_id_barcode_idx" ON "pantry_items"("user_id", "barcode");
ALTER TABLE "meal_plan_items" ADD COLUMN "cooked_at" TIMESTAMP(3);
```
Update `schema.prisma` (`barcode String?`, `@@index([userId, barcode])`, `cookedAt DateTime? @map("cooked_at")`) so `prisma migrate dev` diff is empty. `entrypoint.sh` already runs `prisma migrate deploy`. [VERIFIED: codebase]

### Pattern 2: Pantry PATCH changes (required, not optional)
`validateUpdateItem` has `quantity: isFloat({ gt: 0 })` and `PantryService.updateItem` throws 400 when `quantity <= 0`. Quantity 0 therefore currently FAILS. Change update-only validation to `isFloat({ min: 0, max: 99999 })` and the service check to `< 0`. Keep create at `gt: 0`. Also:
- Add `barcode` to create (optional, `/^\d{8,14}$/`) and update (nullable); persist; include in `formatItem`, `PantryItemResponse`, `CreatePantryItemRequest`/`UpdatePantryItemRequest`, and frontend `PantryItem` types.
- Add `query('barcode').optional().matches(/^\d{8,14}$/)` to `validateGetItems`; in `getItems` add `where.barcode = barcode`. Frontend `pantryApi.getAll` needs a `barcode` param. Use `limit=1`, `sortBy=createdAt desc`.
- `updateItem` fires a Zapier `stock_low` event when `0 < qty <= 2`. Stepper debouncing (one PATCH per settle) keeps this from spamming, but note a "used up" (0) PATCH intentionally does NOT fire it.
- `quantity` is `Decimal(10,2)` and `formatItem` returns `quantity` as a string (`"2.5"`/`"250"`); frontend must `Number()` it.

### Pattern 3: Cook module (pure plan + thin service)
Reuse, do not rewrite:
- `aggregateGroups([{ servings, recipe: { servings, title, ingredientsList } }])` from `mealplan/mealplan.aggregate.ts` already validates ingredient shape, scales by `servings / recipe.servings`, and groups by canonical name + unit family via exact Decimal math.
- `resolveStaples(prefs.stapleNames)` + `filterStaples(groups, staples)` -> `{ kept, skipped }` (skipped names feed the "Staples (not deducted)" note). Load prefs the same way `cook-first.service.ts` does: `prisma.userPreference.findUnique({ where: { userId }, select: { stapleNames: true } })`.
- Matching a group to pantry lots: `canonicalName(lot.ingredientName) === group.canonical` and `groupKey(lot.ingredientName, lot.unit) === group.key` (same family). Lots with the same canonical but a different key -> "Different units (skipped)" note (this mirrors `incompatibleEntry` in `pantry-subtract.ts`). Count-family units are only compatible when `unitKey` matches (`count:pieces` vs `count:can`); `items`/`pieces`/`pc` all normalize to `pieces`.
- Convert recipe need into each lot's unit: `fromBase(group.baseTotal, resolveUnit(lot.unit).unitKey)` (count family: base == quantity).
- Lot ordering: skip expired lots (same rule as `indexStock`), then first-expiring-first with null expiry last. Allocate `need` across lots in that order; one preview row per allocated lot (matches the UI "item, have, use, left" shape). `use = min(need_remaining, have)`, `left = have - use`; if total stock < need, emit a "short" flag so the UI shows "Only {have} {unit} in your pantry. Using all of it."
- Round once with `round2`/`finalizeQuantity`. Note `finalizeQuantity` clamps to `MIN_QUANTITY` 0.01: do not use it for `left` (which can legitimately be 0); use `round2(...).toNumber()`.

Endpoints (suggested, discretion): `POST /api/v1/cook/preview` and `POST /api/v1/cook/apply` (POST is simplest since body carries optional edited servings). Body for preview: `{ recipeId, servings?, mealPlanItemId? }`; if `mealPlanItemId` is given, resolve recipe + servings from the item (ownership check via `mealPlan.userId`), and return `alreadyCooked: boolean` so the sheet can show the amber notice before apply. Apply body: `{ recipeId?, mealPlanItemId?, deductions: [{ pantryItemId: uuid, use: number >= 0 }] }`.

Apply semantics (inside `prisma.$transaction`):
1. If `mealPlanItemId`: `tx.mealPlanItem.updateMany({ where: { id, cookedAt: null, mealPlan: { userId, deletedAt: null } }, data: { cookedAt: new Date() } })`; `count === 0` -> distinguish 404 vs 409 (re-read) and throw `AppError(..., 409, true, { code: 'ALREADY_COOKED' })`. The conditional update is the race-safe once-only guard (two concurrent applies cannot both win). Because it is inside the tx, a later failure rolls the marker back too.
2. `tx.pantryItem.findMany({ where: { id: { in: ids }, userId, deletedAt: null } })`; any missing id -> 404/400. Compute `newQty = max(have - min(use, have), 0)` with `D`; `tx.pantryItem.update` each. Never delete. Cap `deductions` length (e.g. 100) in validation.
3. Return `{ updated: n, usedUp: u, items: [...] }` for the toast copy ("{n} items used, {u} used up").
4. "Mark as cooked" with no deductions is a valid apply with `deductions: []` for a meal-plan item only.
5. Zero-use rows are skipped, not written.

Error shape: reuse `AppError(message, status, true, { code, details })` as in `food.service.ts`, and add `COOK_ERROR_CODES` (`ALREADY_COOKED`, `RECIPE_NOT_FOUND`).

### Pattern 4: Bought-it inside finish
`finishShopping(userId, carryOver, receiptDate)` runs one `$transaction`. Add `addToPantry?: boolean` to `validateFinish` (`.optional().isBoolean().toBoolean()`), pass through the controller (`matchedData`), and extend `FinishShoppingResult` with `pantry?: { added: number; merged: number; failed: boolean }`.

Design decision (UI-SPEC: "Never roll back the finish"): collect the checked items inside the tx (they are already in `items`), return them, and run the pantry merge AFTER the tx commits in its own try/catch (log with `logger.error`, return `failed: true`). Do not put the merge in the same tx. The merge itself should be one `prisma.$transaction` so a partial pantry update does not occur.

Merge algorithm (`shopping-pantry.ts`, pure and unit-tested):
- Load user's non-deleted pantry rows (cap 2000, like `PANTRY_READ_CAP`).
- Per checked item (skip blank names or quantity <= 0): `canonical = canonicalName(item.itemName)`, `family = familyKey(resolveUnit(item.unit))`. Candidate lots = same canonical + same `groupKey`, `expiryDate` null or >= today (UTC), not deleted. Pick the soonest-expiring candidate (null last). If found: `newQty = lot.quantity + fromBase(toBase(item.qty, resolved), lotUnitKey)`, update only `quantity` (and optionally `purchaseDate`). Keep the existing expiry (document this tradeoff: a fresh purchase merged into an older lot inherits its expiry; this matches the locked decision).
- Items in the same trip that share a key must merge with each other too: process sequentially against an in-memory copy (immutably replaced) so two "milk" lines do not both create new rows.
- Else create: `ingredientName` trimmed (max 100), `quantity`, `unit` coerced (below), `category` = `item.category` if it is a valid `PantryCategory` else `inferCategory(name)` (exported from `shopping/shopping.category.ts`), `purchaseDate` = receipt date used for history, `purchasePriceCents` = `actualCostCents ?? costEstimateCents ?? null` (planner may choose actual-only; document it).
- Unit coercion: `resolveUnit(raw)`; for mass/volume use `unitKey` (every registry key equals a `PantryUnit` value); for count use `'pieces'`. The raw word (e.g. "can") can be appended to `notes` if desired. Without this a stored `unit: 'can'` would not exist in the frontend edit-form `<Select>` and `PantryUnit` validation would reject it on the next PATCH of `unit`.
- Quantity max: clamp at 99999 and 2 decimals for the DB `Decimal(10,2)`.

### Pattern 5: Meal plan cooked marker
- Add `cookedAt: string | null` to `MealPlanItemResponse` and `formatMealPlan` (backend `types/mealplan.types.ts`), and to the frontend `MealPlanItem` type.
- PITFALL: `updateMealPlan` with `data.meals` does `mealPlanItem.deleteMany` then creates fresh rows, which would silently un-cook every meal when the user edits the plan. Before the delete, read existing `{recipeId, dayOfWeek, mealType, cookedAt}` and carry `cookedAt` forward onto recreated rows with the same `(recipeId, dayOfWeek, mealType)` triple (consume matches one-to-one). Cover with a test. Also check `createMealPlanFromAI` (new plans, no marker needed).

### Pattern 6: Frontend scanner hook (browser)
```ts
// lib/scan/use-barcode-scanner.ts (sketch; not testable under Vitest 'node' env)
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const;

async function createDetector() {
  const native = (globalThis as { BarcodeDetector?: typeof BarcodeDetector }).BarcodeDetector;
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (supported.includes('ean_13')) return new native({ formats: [...FORMATS] });
    } catch { /* fall through to polyfill */ }
  }
  const { BarcodeDetector: Poly } = await import('barcode-detector/ponyfill'); // lazy chunk
  return new Poly({ formats: [...FORMATS] });
}

const stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
});
// <video playsInline muted autoPlay>; video.srcObject = stream; await video.play();
// loop: const codes = await detector.detect(video); first rawValue wins; setTimeout ~200ms between frames.
// cleanup: stream.getTracks().forEach(t => t.stop()); also on visibilitychange hidden, unmount, detect.
```
Source: Chrome shape-detection guidance (feature-detect by calling, not by `'BarcodeDetector' in window`) [CITED: developer.chrome.com/docs/capabilities/shape-detection]; `barcode-detector` README import paths `barcode-detector/ponyfill` (no global mutation) and `/polyfill` [CITED: github.com/Sec-ant/barcode-detector].

### Anti-Patterns to Avoid
- `'BarcodeDetector' in window` as the only capability check: Chrome desktop on some OSes has the constructor but unsupported formats; probe `getSupportedFormats()` and fall back (UI-SPEC says "in window is false" - treat the probe as the stricter version of that rule).
- Importing `barcode-detector` at module top of any shared component: breaks the lazy-load rule and bloats the pantry route. Use dynamic `import()` inside the hook only.
- Calling `getUserMedia` on page load: permission must be user-initiated (UI-SPEC accessibility).
- Doing the bought-it merge in the same transaction as finish (violates "never roll back the finish").
- Using `finalizeQuantity` for "left" values (clamps to >= 0.01).
- Mutating pantry rows in place client-side; follow the project's immutability rule (return new arrays/objects in optimistic updates).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Barcode decode | Canvas + custom EAN parser | `BarcodeDetector` native / `barcode-detector` ponyfill | ZXing handles blur, rotation, checksums |
| OFF fetch/cache/throttle | New fetch code | `GET /food/barcode/:code` (`lookupBarcode`) | UA, 15 req/min throttle, 30d found / 1d not-found cache exist |
| Name matching | New string normalizer | `canonicalName` | Handles plurals, aliases, qualifiers; idempotent |
| Unit conversion | New factor tables | `resolveUnit`, `toBase`, `fromBase`, `familyKey` | Exact decimal factors; count family never converts |
| Recipe scaling + grouping | New loop | `aggregateGroups` | Already scales by servings and guards bad ingredient rows |
| Staples | New list | `resolveStaples` / `filterStaples` | Exact-canonical match, discrete-count exception |
| Category guess | New map | `inferCategory` (shopping.category.ts) | Locked decision |
| Once-only cook marker | Read-then-write flag | `updateMany` with `cookedAt: null` in the where | Atomic under concurrency |
| Bottom sheet / dialog | New overlay | shared `Modal` (Radix Dialog); Radix Dialog for the full-screen scan sheet | Focus trap, Escape, aria |
| Toast with Undo | Custom toast system | `react-hot-toast` custom render with action button | Already installed |

## Runtime State Inventory

Not a rename/refactor phase. Omitted. (State added: two nullable columns; no existing data needs migration.)

## Common Pitfalls

### Pitfall 1: PATCH rejects quantity 0
**What goes wrong:** Stepper minus to 0 returns 400 "Quantity must be greater than 0"; rollback toast fires on every "used up".
**Why:** `validateUpdateItem` uses `gt: 0` and `updateItem` throws when `<= 0`.
**Avoid:** Relax to `min: 0` on update only; test 0 accepted, negative rejected, > 99999 rejected.

### Pitfall 2: Meal plan edit un-cooks meals
**What goes wrong:** `PATCH /meal-plans/:id` with `meals` recreates all items, resetting `cookedAt`, allowing double deduction.
**Avoid:** Carry `cookedAt` forward by `(recipeId, dayOfWeek, mealType)` before `deleteMany`. Test it.

### Pitfall 3: Unit names in UI-SPEC are not DB values
**What goes wrong:** `stepForUnit('g')` misses because stored unit is `grams`; `liters`, `cups`, `lbs`, `fl_oz` likewise; `can/pack/bottle/box` are not valid pantry units at all.
**Avoid:** Key the step table on actual `PantryUnit` values: pieces 1, items 1, grams 50, kg 0.25, ml 50, liters 0.25, oz 1, lbs 0.25, cups 0.25, tbsp 1, tsp 1, fl_oz 1; default 1. Keep tolerant aliases (`g`, `l`, `cup`, `pcs`) in the helper for robustness. Round steps with decimals-safe math (`0.25` steps accumulate fine but use `Math.round(x*100)/100`).

### Pitfall 4: Pantry quantity precision and strings
`quantity` arrives as a string; `Decimal(10,2)` stores 2 decimals. Display `formatQuantity` trims trailing zeros (UI-SPEC). Parse with `Number`, never concatenate.

### Pitfall 5: Free-text shopping units in bought-it
See Pattern 4 unit coercion. Test: `"can"`, `"bunch"`, `""`, `"Kg"`, `"lb"` all map to valid `PantryUnit` values.

### Pitfall 6: Barcode format drift (UPC-A vs EAN-13)
A UPC-A scan yields 12 digits; the same product is 13 digits with a leading 0 as EAN-13. Normalize once in `normalizeBarcode` (strip non-digits; left-pad 12 -> 13) and store/query the normalized form so repeat scans match. Whether OFF resolves a 12-digit code is [ASSUMED] (OFF generally normalizes); padding to 13 avoids the question. Validate 8-14 digits to match the backend regex `^\d{8,14}$`. Add `isValidBarcode`, test with EAN-8, UPC-E (8 digits), 13, 14, and junk.

### Pitfall 7: Pantry page is not React Query
`PantryPage` holds `items` in `useState` and refetches on every change. A debounced optimistic stepper needs per-item pending values and rollback. Recommended: migrate list loading to `useQuery({ queryKey: queryKeys.pantry.list(filters) })` and write `usePantryQuantityMutation` with `onMutate` (cancel, snapshot, `setQueryData` to a new array), `onError` rollback, per-item debounce in a ref map (cleared on unmount). Keep the 400ms debounce per item, not global. Also note the list is capped at `limit` default 50 and the page does not paginate (pre-existing).

### Pitfall 8: Scan sheet stream leaks / double detection
Stop tracks on close, detect, manual switch, unmount and `visibilitychange`; guard with a `lookingUp` ref so repeated detections during lookup are ignored. On iOS a still-running stream keeps the camera indicator on. Clear the detect-loop timer in cleanup (React 19 StrictMode double-invokes effects in dev).

### Pitfall 9: iOS Safari camera constraints
- `getUserMedia` needs a secure context (HTTPS; Vercel is HTTPS, `localhost` OK); `navigator.mediaDevices` is undefined otherwise -> "Scanning isn't available here" state.
- `<video>` must have `playsInline` (and `muted`, `autoPlay`) or iOS opens fullscreen/refuses to play inline. [ASSUMED from WebKit behavior; verify on device]
- Native `BarcodeDetector` is NOT usable on iOS (Safari flag broke in iOS 18, WebKit bug 281848; all iOS browsers use WebKit) so the polyfill path is the iOS path. [CITED: developer.apple.com/forums/thread/767761; eringen.substack.com]
- Torch via `track.getCapabilities().torch` is generally unavailable on iOS Safari; show the torch button only if the capability is reported (UI-SPEC already says so). [ASSUMED]
- Installed standalone PWAs may re-prompt for camera permission each launch. [ASSUMED]; keep the "denied" copy variant for standalone from UI-SPEC (`lib/pwa/detect-ios.ts` exists).
- Denied errors: `NotAllowedError` -> denied; `NotFoundError`/`OverconstrainedError` -> no camera; `NotReadableError` -> camera busy (map to the unsupported/denied card with Try again).

### Pitfall 10: ZXing WASM hosting and CSP
By default `zxing-wasm` fetches its `.wasm` (~1.0 MiB reader build) from a jsDelivr URL at first use; it can be redirected with `prepareZXingModule({ overrides: { locateFile } })` and the wasm version must match the installed lib (`ZXING_WASM_VERSION`). [CITED: github.com/Sec-ant/zxing-wasm] The Vercel frontend currently sets NO Content-Security-Policy (`next.config.ts` returns `{}`; helmet CSP is on the Express API only and does not apply to the frontend), and there is no service worker yet (`app/sw.ts` absent), so the default CDN works as-is. Recommendation: accept the default CDN for this phase (failure falls back to manual entry per CAP-02), note that a future CSP must allow `cdn.jsdelivr.net` in `connect-src` plus `'wasm-unsafe-eval'` in `script-src` [ASSUMED: standard browser behavior], and if self-hosting is wanted later copy the wasm to `public/` and use `locateFile`. The backend helmet CSP (`connectSrc: 'self'`) is irrelevant because the browser, not the API, fetches OFF data through the backend.

### Pitfall 11: Smoke script is run against a fresh user
`smoke-prod.sh` creates `smoke+<epoch>` users that persist; every name in new checks must carry the `$EPOCH` tag (see check 13). Pantry endpoints are under the global `apiLimiter`; the finish and food routes have their own limiters (`foodBurstLimiter`, `shoppingLimiter`). The smoke check must not hit OFF live more than once (15 req/min per IP); prefer asserting the 404/validation behavior (`/food/barcode/00000000` style) or one live lookup guarded like `--ai-live`.

## Code Examples

### PATCH update validation (relax to 0)
```ts
// pantry.validation.ts (update only)
body('quantity')
  .optional()
  .isFloat({ min: 0, max: 99999 })
  .withMessage('Quantity must be between 0 and 99999'),
body('barcode')
  .optional({ nullable: true })
  .custom((v) => v === null || (typeof v === 'string' && /^\d{8,14}$/.test(v)))
  .withMessage('Barcode must be 8 to 14 digits or null'),
```

### Race-safe once-only cook marker
```ts
// cook.service.ts (inside prisma.$transaction(async (tx) => { ... }))
const marked = await tx.mealPlanItem.updateMany({
  where: { id: mealPlanItemId, cookedAt: null, mealPlan: { userId, deletedAt: null } },
  data: { cookedAt: new Date() },
});
if (marked.count === 0) {
  const exists = await tx.mealPlanItem.findFirst({
    where: { id: mealPlanItemId, mealPlan: { userId, deletedAt: null } },
    select: { cookedAt: true },
  });
  if (!exists) throw new AppError('Meal not found', 404);
  throw new AppError('This meal is already marked as cooked.', 409, true, { code: 'ALREADY_COOKED' });
}
```

### Deduction row for one lot (pure)
```ts
// cook.plan.ts: need is a Dec in base units for the group; lot unit may differ within the family
const lotUnit = resolveUnit(lot.unit);
const haveBase = toBase(parseDec(lot.quantity)!, lotUnit);
const useBase = need.lt(haveBase) ? need : haveBase;
const use = round2(fromBase(useBase, lotUnit.unitKey)).toNumber();
const left = round2(fromBase(haveBase.minus(useBase), lotUnit.unitKey)).toNumber(); // may be 0
```

### Client step helper (pure, Vitest)
```ts
// lib/pantry/quantity.ts
const STEPS: Readonly<Record<string, number>> = {
  pieces: 1, items: 1, grams: 50, kg: 0.25, ml: 50, liters: 0.25,
  oz: 1, lbs: 0.25, cups: 0.25, tbsp: 1, tsp: 1, fl_oz: 1,
};
export const stepForUnit = (unit: string): number => STEPS[unit] ?? 1;
export const clampQuantity = (n: number): number =>
  Number.isFinite(n) ? Math.min(99999, Math.max(0, Math.round(n * 100) / 100)) : 0;
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `'BarcodeDetector' in window` | Probe `getSupportedFormats()` / try `detect()` | Avoids false positives on partial native support |
| `setZXingModuleOverrides` | `prepareZXingModule({ overrides })` | The old name is deprecated in zxing-wasm docs [CITED: github.com/Sec-ant/zxing-wasm] |
| `barcode-detector/pure` / `/side-effects` | `/ponyfill` / `/polyfill` | Old names deprecated [CITED: github.com/Sec-ant/barcode-detector] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `barcode-detector` is legitimate (slopcheck unavailable) | Package Audit | Supply-chain; mitigated by human-verify checkpoint before install |
| A2 | OFF resolves 12-digit UPC-A; padding to EAN-13 is safe either way | Pitfall 6 | Lookup misses; padding mitigates |
| A3 | iOS needs `playsInline`/`muted`/`autoPlay`; torch unavailable on iOS; standalone PWA re-prompts | Pitfall 9 | Real-iPhone checkpoint catches it |
| A4 | `detect()` in the polyfill accepts an `HTMLVideoElement` directly | Pattern 6 | If not, draw frames to a canvas / `createImageBitmap` and detect on that |
| A5 | CSP future needs `wasm-unsafe-eval` and jsDelivr allowance | Pitfall 10 | None now (no CSP) |
| A6 | `purchasePriceCents` for bought-it = `actualCostCents ?? costEstimateCents` | Pattern 4 | Minor; planner may choose actual-only |

## Open Questions

1. **Per-lot vs per-ingredient preview rows**
   - Known: UI-SPEC shows "item, have, use, left" per pantry item; pantry can hold several lots of one ingredient.
   - Recommendation: per-lot rows grouped under the ingredient, FEFO allocation; "Use" editable per row.
2. **Meal-plan item "Cooked it" when the recipe was deleted**
   - `MealPlanItem.recipe` is a required relation (no cascade); recipe soft-delete (`deletedAt`) may hide it. Recommend cook preview returns 404 `RECIPE_NOT_FOUND` for soft-deleted recipes and the sheet shows the preview error state.
3. **Real-iPhone scan behavior** (CAP-01): cannot be verified from this environment; schedule as the final deferrable human checkpoint (per CONTEXT).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | yes | v24.9.0 | — |
| psql / pg_isready | local Jest DB tests | binaries yes, server NOT running (`/tmp:5432 - no response`) | — | Start local Postgres (brew services or `docker compose up` in `backend/docker-compose.yml`) before running backend tests |
| Docker | local Postgres | yes | installed | — |
| Railway CLI | deploy + smoke | yes | installed | — |
| Vercel CLI | frontend deploy | yes | installed | push to main triggers deploy |
| pip / slopcheck | package audit | no | — | Human-verify checkpoint for `barcode-detector` |
| Real iPhone/Android | scan verification | not available | — | Deferrable human checkpoint |

**Missing with no fallback:** none blocking.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend | Jest 29 + ts-jest + supertest 6; config `backend/jest.config.js`, tests in `backend/tests/*.test.ts`, real Postgres via Prisma (`tests/setup.ts` sets 30s timeout) |
| Frontend | Vitest 5.0.3, `environment: 'node'`, `include: ['lib/**/*.test.ts']` (pure helpers only; no jsdom, so hooks/components are NOT unit-tested) |
| Quick run (backend) | `cd backend && npx jest tests/pantry-capture.test.ts tests/cook-plan.test.ts --coverage=false` |
| Quick run (frontend) | `cd frontend && npx vitest run` |
| Full suite | `cd backend && npm run lint && npm test && npm run build` ; `cd frontend && npm run lint && npm run type-check && npm test && NEXT_PUBLIC_API_URL=https://x.example npx next build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CAP-01 | Create/update/list-by `barcode`; validation 8-14 digits | integration | `npx jest tests/pantry-capture.test.ts` | Wave 0 |
| CAP-01 | `normalizeBarcode` / `isValidBarcode` (EAN-8/13, UPC-A pad, junk) | unit (Vitest) | `npx vitest run lib/scan` | Wave 0 |
| CAP-01/02 | Food endpoint 200/404/429/503 mapping stays green | integration | `npx jest tests/food-lookup.test.ts` | exists |
| CAP-02 | Scan state machine / camera errors | manual (device) | real-phone checkpoint | manual-only: needs camera |
| CAP-03 | Merge vs create, same canonical + family, expired lot not merged, cross-family not merged, unit coercion, duplicate lines in one trip, finish still succeeds when pantry step fails | unit (pure `planPantryMerge`) + integration | `npx jest tests/shopping-finish-pantry.test.ts` | Wave 0 |
| CAP-04 | `computeCookPlan`: scaling, same-family conversion (g<->kg, cups<->tbsp), cross-family skipped, staples skipped, not-in-pantry listed, short stock, FEFO across lots, expired lot ignored | unit | `npx jest tests/cook-plan.test.ts` | Wave 0 |
| CAP-04 | Apply: floor 0, nothing deleted, ownership (other user's item id -> 404), clamp `use<=have`, 409 `ALREADY_COOKED` on second apply, concurrent double-apply yields one winner, rollback on failure | integration | `npx jest tests/cook-endpoints.test.ts` | Wave 0 |
| CAP-04 | Meal plan `cookedAt` survives `PATCH meals` replace | integration | `npx jest tests/mealplan-cooked.test.ts` | Wave 0 |
| CAP-05 | PATCH quantity 0 accepted, negative/over-max rejected, expiryDate null clears | integration | `npx jest tests/pantry.test.ts tests/pantry-capture.test.ts` | pantry.test.ts exists (update its `quantity` expectations if any assert 0 rejected) |
| CAP-05 | `stepForUnit`, `clampQuantity`, `formatQuantity`, `addDays` shortcuts (empty/past -> today base, month/year rollover, leap day) | unit (Vitest) | `npx vitest run lib/pantry` | quantity: Wave 0; expiry.test.ts exists, extend |
| All | Live API contract incl. new endpoints | smoke | `API=<railway> scripts/smoke-prod.sh --api-only` (new check 14, own tagged names) | Wave 0 (extend script) |

### Sampling Rate
- **Per task commit:** quick run for the touched side + `tsc --noEmit` / `npm run type-check`.
- **Per wave merge:** full backend suite; frontend lint + type-check + vitest.
- **Phase gate:** full suites green, `next build` green, backend deployed to Railway and smoke check 14 passing BEFORE pushing the frontend; then real-phone scan checkpoint (deferrable).

### Wave 0 Gaps
- [ ] `backend/tests/pantry-capture.test.ts`, `cook-plan.test.ts`, `cook-endpoints.test.ts`, `shopping-finish-pantry.test.ts`, `mealplan-cooked.test.ts`
- [ ] `frontend/lib/scan/barcode.test.ts`, `frontend/lib/pantry/quantity.test.ts`, `frontend/lib/cook/preview.test.ts`; extend `frontend/lib/pantry/expiry.test.ts`
- [ ] Start local Postgres before backend tests (not running now)
- [ ] `scripts/smoke-prod.sh` check 14 (update header usage comment like checks 11-13)
- No new framework installs needed. Coverage target 80% on new backend modules and pure helpers.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (existing) | All new routes behind `authenticate` |
| V4 Access Control | yes | Every pantry/meal-plan/recipe id scoped by `userId` (cook apply must re-verify each `pantryItemId` and `mealPlanItemId` ownership server-side; never trust client "have" values) |
| V5 Input Validation | yes | express-validator: UUIDs, `use` finite 0..99999, `deductions` length cap, barcode `^\d{8,14}$`, `addToPantry` boolean |
| V6 Cryptography | no | none |
| V12 Files/Resources | minor | OFF image URLs already restricted by `safeImageUrl`; keep |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| IDOR on pantry/meal-plan ids in cook apply | Elevation | `findMany({ id in, userId })` and compare counts; ownership in `updateMany` where |
| Double-apply / replay of cook | Tampering | Conditional `cookedAt: null` update inside the tx |
| Client forging "use" above stock | Tampering | Server clamps `min(use, have)` from freshly read rows |
| Quantity overflow / NaN | Tampering | Bounds 0..99999, `Number.isFinite`, Decimal math |
| OFF abuse via scan loop | DoS | Existing throttle + cache; client ignores repeat detections while looking up; `foodBurstLimiter` stays |
| Camera privacy | Info disclosure | Request only on user action; stop tracks on every exit; no frames leave the device (decode is local, only the numeric barcode is sent) |
| Free-text names into DB/HTML | Injection/XSS | Prisma parameterization; React escaping; length caps (name 100, notes 500) |

## Project Constraints (from CLAUDE.md)
- Keep Next.js + Express + Prisma + Postgres; no rewrite; Prisma stays 5.22.x.
- Immutability; files < 800 lines (200-400 typical); functions < 50 lines; validation at boundaries; no hardcoded values; errors never swallowed (log server-side).
- Tests: 80% coverage target; TDD (write tests first).
- Free tiers only; no secrets committed; Railway variables for secrets.
- Never edit applied migrations (additive only); do not add `railway.json`.
- GSD workflow: all repo edits go through GSD execution commands.
- Frontend UI rules from UI-SPEC: sizes 16/14/20px and weights 400/600 only; 44px targets; no new UI dependency; one component per file under 400 lines; no emoji.
- `meal-plan.service.ts` is already 805 lines: do NOT add logic there beyond the small `cookedAt` carry-forward; put new logic in `cook/`. Prefer extracting the carry-forward helper into a small file (e.g. `mealplan/mealplan.cooked.ts`).

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `backend/src/modules/{pantry,food,intelligence,shopping,mealplan}/*`, `backend/prisma/schema.prisma`, `backend/src/app.ts`, `scripts/smoke-prod.sh`, `frontend/components/{pantry,shopping,food}/*`, `frontend/app/(app)/pantry/page.tsx`, `frontend/lib/{api,pantry,hooks}/*`, `frontend/next.config.ts`
- `.planning/phases/06-capture-loops/06-CONTEXT.md`, `06-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, project `CLAUDE.md`
- npm registry: `npm view barcode-detector` (3.2.2, MIT, dep zxing-wasm 3.1.3), `npm view zxing-wasm` (3.1.5)

### Secondary (MEDIUM confidence)
- https://github.com/Sec-ant/barcode-detector (import paths, formats, wasm CDN default, `prepareZXingModule`)
- https://github.com/Sec-ant/zxing-wasm (`locateFile` override, reader build ~1.04 MiB)
- https://developer.chrome.com/docs/capabilities/shape-detection (feature detection guidance)
- https://developer.apple.com/forums/thread/767761 and https://eringen.substack.com/p/barcode-scanning-on-ios-the-missing (Safari/iOS BarcodeDetector status)

### Tertiary (LOW confidence)
- iOS `playsInline`, torch, standalone re-prompt behavior (training knowledge; verify on device)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (only one new dependency, locked)
- Architecture: HIGH (grounded in read code; helpers verified to exist)
- Pitfalls: HIGH for backend/codebase, MEDIUM for iOS/WASM runtime behavior

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (stable); re-check `barcode-detector` release notes if install is delayed
