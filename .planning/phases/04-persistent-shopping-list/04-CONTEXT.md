# Phase 4: Persistent Shopping List - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users keep real shopping lists that survive reloads and device changes and are easy to use in the store. Covers SHOP-01..SHOP-05: backend-stored lists (new `shopping` module wired to the existing Prisma models), manual add/edit/remove/check-off with persisted check-offs, generate a list from a meal plan (saved), items grouped by category with a shopping mode (screen awake, big check rows), and estimated vs actual spend. Pantry-aware subtraction, unit conversion and "bought it" -> pantry are LATER phases (5, 6): do not build them here.

</domain>

<decisions>
## Implementation Decisions

### List model (user decision)
- One active list per user plus history. Active list = `ShoppingList` with `isCompleted=false` and `deletedAt IS NULL`; the backend lazily creates it (name e.g. "Shopping list") when the user first adds an item or generates one. Enforce one-active-per-user with an additive partial unique index (`user_id` where `is_completed=false AND deleted_at IS NULL`) in a new migration (additive only; existing data must not break: dedupe/complete any pre-existing duplicate active lists defensively in the migration or code path).
- "Finish shopping" marks the list completed (`isCompleted`, `completedAt`), writes a `ShoppingHistory` row (receiptDate = today, total = sum of actual costs, falling back to estimates when no actuals; note the existing column is named `total_php_cents` but holds cents in the user's currency: do not rename, document it), and the next add starts a fresh active list. Unchecked items on finish: ask the user (keep on a new list or discard) with a sensible default (carry over unchecked items to the new active list).
- Generating from a meal plan merges into the ACTIVE list (appends ingredients from the plan; merge identical `itemName+unit` by summing quantity; no pantry subtraction or unit conversion yet; those arrive in Phase 5).

### Items
- Item fields use the existing `ShoppingListItem` columns: itemName, quantity (Decimal), unit (use the API's unit values such as `pieces`, not `pcs`), category, costEstimateCents, actualCostCents, isChecked, notes. Category uses the existing pantry categories; unknown/blank = "Other" (last).
- Manual add: quick-add row at the top (name + optional qty/unit/category, Enter to add), edit sheet, delete with undo toast. Check-off persists immediately (optimistic update with rollback on error). Money is stored in cents of the user's currency (Phase 3 `useCurrency().format`, `parseMajorToCents` strict parser; no float math).

### Grouping and shopping mode (user decisions)
- Group by pantry category as collapsible sections; checked items drop to the bottom of their section (or to a collapsed "In cart" group); "Other" last.
- Shopping mode toggle: keeps the screen awake via the Screen Wake Lock API where supported (feature-detect, release on toggle off/visibilitychange/unmount, fall back silently), larger 56px check rows (UI-SPEC Phase 3 rules: 44px min targets, 16px inputs, 4 font sizes/2 weights, safe-area), checked items sink, and a sticky summary bar showing estimated vs actual total in the user's currency.
- Estimated vs actual (SHOP-05): each item has an optional estimate and an optional actual price; the summary shows estimated total, actual total (of items with actuals) and difference. Reuse existing market price/estimate data only if trivially available; otherwise estimates are user-entered or carried from the meal plan.

### API contract (backend)
- New `backend/src/modules/shopping` with express-validator validation, auth required, ownership checks on every id (a user can never read/modify another user's list/items), consistent error shape (`message`, `error`, `code`). Endpoints (planner may refine names, but align to the existing frontend client `frontend/lib/api/shopping.ts` where sensible): GET active list (creating lazily), POST item, PATCH item (name, qty, unit, category, checked, estimate, actual, notes), DELETE item (+ restore/undo path or client-side re-create), POST generate-from-meal-plan, POST finish (with carry-over option), GET history (paginated).
- Replace the current frontend `sessionStorage` shopping list; migrate any existing sessionStorage list on first load (best effort) or drop it. `clearUserSessionState` (Phase 3) already clears the `current-shopping-list` storage key: keep logout clearing working.
- Rate limiting/size limits: max items per list (e.g. 300), max name length, quantity/price bounds (int4-safe cents), sanitize strings.

### Frontend and design
- Reuse the Phase 3 design system and UI-SPEC rules (no new UI-SPEC for this phase): bottom sheets via the shared Radix `Modal`, `EmptyState` ("Your shopping list is empty" with primary "Add item" now available, secondary "Go to meal plans"), currency via `useCurrency`, 375px first. The page must work offline-tolerant only in the sense of clear errors (no service worker).
- Tests: backend Jest + supertest for every endpoint (ownership, validation, lazy create, one-active enforcement, finish/history, merge-on-generate); Vitest for pure helpers (grouping, totals, merge). Frontend gates: lint, type-check, vitest, `next build`.

### Delivery
- Backend first: additive Prisma migration + module, deploy to Railway (`cd backend && railway link --project kitcha --environment production`, confirm `railway status` shows `kitcha`, `railway up --service kitcha-api --detach`, verify migration logs and /health, extend `scripts/smoke-prod.sh` with shopping checks using its own smoke user), THEN push the frontend to main (Vercel auto). The frontend must tolerate the endpoints being unavailable (clear error state). CI must stay green.
- Manual real-phone check of shopping mode (wake lock, thumb reach) is a final deferrable human checkpoint.

### Resolved research questions (orchestrator decisions, 2026-10-09)
- History total on finish = sum over CHECKED items of `actualCostCents ?? costEstimateCents ?? 0` (per-item fallback), clamped to int4 max.
- Merge on generate-from-meal-plan only combines into existing UNCHECKED items (same name case-insensitive + same unit); checked items are left alone and a new line is added. Estimated-vs-actual difference is computed over items that have an actual price.
- Include a small `inferCategory` keyword map (used for generated lists and quick-add when no category is chosen); unknown = "Other".
- The Meal Plans page preview/detail gets an "Add to my list" button that calls the new generate endpoint.
- Add a dedicated shopping rate limiter (generous, per user) and make the global `apiLimiter` skip `/api/v1/shopping` (match on `originalUrl`), because rapid check-offs would otherwise hit 100 requests/15 min.
- Fix the existing `mealplan.service` ingredient-name truncation (`key.split(":")[0]`) when reusing it; one shared `lib/shopping/vocab.ts` for categories/units aligned to the backend enums (frontend constants currently disagree).
- Per-item money cap 200,000,000 cents; max 300 items per list; every mutation in a transaction holding the list row lock; partial unique index is hand-written migration SQL (completes duplicate active lists first) with a comment in schema.prisma; keep `prisma migrate diff --exit-code` clean.
- Frontend testable logic must live as pure helpers under `frontend/lib/` (Vitest only runs `lib/**/*.test.ts` in node env). No new packages (use a small aria-expanded section, not Radix accordion). Wake Lock hook re-requests on `visibilitychange`, fails silently.

### Claude's Discretion
Endpoint naming, component structure, section collapse behavior, undo implementation, carry-over default UX, plan splitting.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Prisma models `ShoppingList`, `ShoppingListItem`, `ShoppingHistory` already exist (with soft delete, isChecked, estimate/actual cents, categories). No backend module or routes exist. `frontend/lib/api/shopping.ts` + `types/shopping.types.ts` exist but target unimplemented endpoints; `frontend/app/(app)/shopping/page.tsx` keeps a generated list in `sessionStorage`. `mealplan.service.ts` has the existing naive ingredient aggregation (merge on exact `name:unit`).
- Phase 3: `EmptyState`, `Modal` (Radix), `useCurrency`, `parseMajorToCents`, `parseBudgetInput`, `isTextEntry`, bottom nav + More sheet, `clearUserSessionState`.

### Established Patterns
- Backend modules with routes/controller/service/validation; express-validator; Jest + supertest with a temp Postgres; additive Prisma migrations applied by the entrypoint on deploy; React Query for server state on the frontend.

### Integration Points
- `backend/src/app.ts` (register routes), `backend/prisma/schema.prisma`, mealplan module (generate-from-plan), shopping page, dashboard widgets that may show list counts, smoke script.

</code_context>

<specifics>
## Specific Ideas

Used on a phone in the grocery aisle: speed of adding and checking items matters most.

</specifics>

<deferred>
## Deferred Ideas

- Pantry subtraction, staples, unit conversion/merge across units (Phase 5).
- "Bought it" -> add to pantry, "cooked it" deduction (Phase 6).
- Multiple named lists, sharing/household (v2).

</deferred>
