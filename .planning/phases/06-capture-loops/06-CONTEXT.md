# Phase 6: Capture Loops - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The pantry stays accurate with minimal typing as users scan, shop and cook: barcode scan prefills the pantry form from Open Food Facts (CAP-01, CAP-02), "bought it" from shopping (CAP-03), "cooked it" deduction from recipes/meals (CAP-04), and quick +/- and expiry edits on the pantry list (CAP-05).

</domain>

<decisions>
## Implementation Decisions

### Barcode scan (CAP-01, CAP-02)
- Scanner: native `BarcodeDetector` where available, else the `barcode-detector` (ZXing-WASM) polyfill for iOS; lazy-loaded only on the scan screen (per STACK.md; verify on a real iPhone as a deferrable checkpoint).
- Entry points: a "Scan" button in the Add Pantry modal and a camera icon in the pantry page header; opens a full-screen camera sheet and prefills the add form on a hit.
- Failure, permission denied or unknown product: fall back to the manual form with the barcode kept, plus a "type the barcode" field. Nothing blocks the user.
- Storage: new nullable `PantryItem.barcode` column via an additive migration (never touch applied migrations); shown on the edit form and used to prefill repeat scans.
- Open Food Facts requests keep the required `User-Agent`; each product is cached in Postgres (reuse the existing backend `food` module and `frontend/components/food/barcode-lookup.tsx`).

### Bought it and Cooked it (CAP-03, CAP-04)
- Bought it: the finish-shopping sheet gets an opt-in "Add checked items to pantry" toggle, on by default. No mid-aisle prompt on check-off.
- Bought-it merge: merge into an existing non-expired pantry item with the same canonical name and unit family (Phase 5 helpers); otherwise create a new item with category from `inferCategory`, purchase date and price from the list item.
- Cooked it: a "Cooked it" button on recipe detail and on a meal-plan item showing a preview of deductions (item, have, use, left) that the user can confirm or edit before applying.
- Deduction rules: scale by servings; subtract within unit families only (never across families); floor at 0; delete nothing (zero-quantity items stay, flagged "used up"); ingredients not in the pantry are skipped and listed; staples are not deducted; a meal-plan item is marked cooked once so it cannot be applied twice.

### Pantry quick-edit and delivery (CAP-05)
- Quantity +/-: stepper on each pantry card (44px targets) with a smart step per unit (pieces 1, g 50, kg 0.25, ml 50, etc.), optimistic and debounced with rollback on error; tapping the number allows direct entry.
- Expiry: tapping the expiry chip opens a small bottom sheet with a date input and +1d/+3d/+7d/clear shortcuts.
- Backend: reuse `PATCH /pantry/:id` if it supports partial updates, else add a lean one. Quantity never below 0; 0 shows a "used up" state with one-tap remove.
- Delivery: as in Phases 4 and 5: additive migration and backend first (Railway, extend `scripts/smoke-prod.sh` with its own smoke user), then push the frontend to main (Vercel). CI stays green. Real-phone camera test is a final deferrable human checkpoint.

### Claude's Discretion
Module and file names, exact step sizes, sheet component structure, endpoint naming, plan splitting and waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Backend `modules/food` (`off.client.ts`, `food.service.ts`, attribution) and frontend `components/food/barcode-lookup.tsx`, `lib/api/food.ts`.
- Phase 5 `modules/intelligence` (canonicalName, unit families, conversion), Phase 4 `modules/shopping` and `components/shopping/*` (finish-sheet), Phase 3 shared Modal/bottom sheets, `useCurrency`.
- `components/pantry/{add-pantry-item-modal,edit-pantry-item-modal,pantry-item-card}.tsx`.

### Established Patterns
- express-validator, ownership checks, error shape `message/error/code`, additive Prisma migrations, Jest + supertest, Vitest only for `frontend/lib/**` pure helpers, optimistic React Query updates.

### Integration Points
- `PantryItem` schema (no barcode yet), shopping finish flow, recipe detail and meal-plan item UI, `MealPlanItem` (needs a cooked marker), pantry list page.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the accepted recommendations.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
