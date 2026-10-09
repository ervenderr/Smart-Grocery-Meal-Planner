# Phase 4: Persistent Shopping List - Research

**Researched:** 2026-10-09
**Domain:** Express + Prisma 5.22 + Postgres CRUD module (shopping list), Next.js 16 / React Query 5 mobile UI, Screen Wake Lock
**Confidence:** HIGH (backend/DB behaviors verified empirically against a throwaway Postgres 16; frontend patterns verified against repo code and official docs; two items ASSUMED, see log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**List model (user decision)**
- One active list per user plus history. Active list = `ShoppingList` with `isCompleted=false` and `deletedAt IS NULL`; the backend lazily creates it (name e.g. "Shopping list") when the user first adds an item or generates one. Enforce one-active-per-user with an additive partial unique index (`user_id` where `is_completed=false AND deleted_at IS NULL`) in a new migration (additive only; existing data must not break: dedupe/complete any pre-existing duplicate active lists defensively in the migration or code path).
- "Finish shopping" marks the list completed (`isCompleted`, `completedAt`), writes a `ShoppingHistory` row (receiptDate = today, total = sum of actual costs, falling back to estimates when no actuals; note the existing column is named `total_php_cents` but holds cents in the user's currency: do not rename, document it), and the next add starts a fresh active list. Unchecked items on finish: ask the user (keep on a new list or discard) with a sensible default (carry over unchecked items to the new active list).
- Generating from a meal plan merges into the ACTIVE list (appends ingredients from the plan; merge identical `itemName+unit` by summing quantity; no pantry subtraction or unit conversion yet; those arrive in Phase 5).

**Items**
- Item fields use the existing `ShoppingListItem` columns: itemName, quantity (Decimal), unit (use the API's unit values such as `pieces`, not `pcs`), category, costEstimateCents, actualCostCents, isChecked, notes. Category uses the existing pantry categories; unknown/blank = "Other" (last).
- Manual add: quick-add row at the top (name + optional qty/unit/category, Enter to add), edit sheet, delete with undo toast. Check-off persists immediately (optimistic update with rollback on error). Money is stored in cents of the user's currency (Phase 3 `useCurrency().format`, `parseMajorToCents` strict parser; no float math).

**Grouping and shopping mode (user decisions)**
- Group by pantry category as collapsible sections; checked items drop to the bottom of their section (or to a collapsed "In cart" group); "Other" last.
- Shopping mode toggle: keeps the screen awake via the Screen Wake Lock API where supported (feature-detect, release on toggle off/visibilitychange/unmount, fall back silently), larger 56px check rows (UI-SPEC Phase 3 rules: 44px min targets, 16px inputs, 4 font sizes/2 weights, safe-area), checked items sink, and a sticky summary bar showing estimated vs actual total in the user's currency.
- Estimated vs actual (SHOP-05): each item has an optional estimate and an optional actual price; the summary shows estimated total, actual total (of items with actuals) and difference. Reuse existing market price/estimate data only if trivially available; otherwise estimates are user-entered or carried from the meal plan.

**API contract (backend)**
- New `backend/src/modules/shopping` with express-validator validation, auth required, ownership checks on every id (a user can never read/modify another user's list/items), consistent error shape (`message`, `error`, `code`). Endpoints (planner may refine names, but align to the existing frontend client `frontend/lib/api/shopping.ts` where sensible): GET active list (creating lazily), POST item, PATCH item (name, qty, unit, category, checked, estimate, actual, notes), DELETE item (+ restore/undo path or client-side re-create), POST generate-from-meal-plan, POST finish (with carry-over option), GET history (paginated).
- Replace the current frontend `sessionStorage` shopping list; migrate any existing sessionStorage list on first load (best effort) or drop it. `clearUserSessionState` (Phase 3) already clears the `current-shopping-list` storage key: keep logout clearing working.
- Rate limiting/size limits: max items per list (e.g. 300), max name length, quantity/price bounds (int4-safe cents), sanitize strings.

**Frontend and design**
- Reuse the Phase 3 design system and UI-SPEC rules (no new UI-SPEC for this phase): bottom sheets via the shared Radix `Modal`, `EmptyState` ("Your shopping list is empty" with primary "Add item" now available, secondary "Go to meal plans"), currency via `useCurrency`, 375px first. The page must work offline-tolerant only in the sense of clear errors (no service worker).
- Tests: backend Jest + supertest for every endpoint (ownership, validation, lazy create, one-active enforcement, finish/history, merge-on-generate); Vitest for pure helpers (grouping, totals, merge). Frontend gates: lint, type-check, vitest, `next build`.

**Delivery**
- Backend first: additive Prisma migration + module, deploy to Railway (`cd backend && railway link --project kitcha --environment production`, confirm `railway status` shows `kitcha`, `railway up --service kitcha-api --detach`, verify migration logs and /health, extend `scripts/smoke-prod.sh` with shopping checks using its own smoke user), THEN push the frontend to main (Vercel auto). The frontend must tolerate the endpoints being unavailable (clear error state). CI must stay green.
- Manual real-phone check of shopping mode (wake lock, thumb reach) is a final deferrable human checkpoint.

### Claude's Discretion
Endpoint naming, component structure, section collapse behavior, undo implementation, carry-over default UX, plan splitting.

### Deferred Ideas (OUT OF SCOPE)
- Pantry subtraction, staples, unit conversion/merge across units (Phase 5).
- "Bought it" -> add to pantry, "cooked it" deduction (Phase 6).
- Multiple named lists, sharing/household (v2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | Lists stored in backend (new `shopping` module on existing models), survive reload/device change | Active-list lazy create with partial unique index + `ON CONFLICT DO NOTHING` (verified); module layout; React Query refetch-on-focus for multi-device |
| SHOP-02 | Add, edit, remove, check off items; check-offs persist | Item endpoints, validation bounds, optimistic mutation pattern, delete returns row for undo via re-POST |
| SHOP-03 | Generate list from a meal plan; saved | Reuse `MealPlanService.generateShoppingList`; server-side merge into active list under row lock; known aggregation bug (":" in names) |
| SHOP-04 | Items grouped by store category; shopping mode keeps screen awake with large targets | Category normalization (11 backend categories vs 7 frontend), collapsible without new deps, Wake Lock hook |
| SHOP-05 | Estimated vs actual spend | Pure `computeTotals` helper; finish writes `ShoppingHistory`; int4-safe bounds |
</phase_requirements>

## Summary

The three Prisma models (`ShoppingList`, `ShoppingListItem`, `ShoppingHistory`) already exist in the schema and the initial migration; no shopping backend module exists. The work is: (1) one additive migration holding a partial unique index, (2) a `shopping` module mirroring `pantry` (routes/controller/service/validation, `authenticate`, `asyncHandler`, `AppError`), (3) a refactor-light reuse of `MealPlanService.generateShoppingList`, (4) a rewrite of the frontend shopping page onto React Query with optimistic check-offs, grouped collapsible sections, shopping mode with a Wake Lock hook, and a sticky totals bar.

Two findings change the plan. First, **the global `apiLimiter` allows only 100 requests per 15 minutes per IP on every `/api/` route** (`backend/src/middleware/rateLimiter.ts`); optimistic check-offs in the aisle plus refetches will hit it, so shopping routes need their own, higher limiter and an exemption from the global one. Second, **Prisma 5.22 does not detect the partial index as drift**: I verified `prisma migrate diff --exit-code` returns 0 both DB-vs-schema and migrations-vs-schema (shadow DB) after the index exists, so no schema edit or CI change is needed; just document it with a comment in `schema.prisma`.

**Primary recommendation:** Backend-first plan: migration + `shopping` module with a single `ensureActiveList(tx, userId)` primitive (raw `INSERT ... ON CONFLICT DO NOTHING` then `SELECT`), every mutation inside `prisma.$transaction` with a `SELECT ... FOR UPDATE` on the list row; map Decimal to `number` in one `toItemDto`; dedicated shopping rate limiter; then frontend with pure helpers in `frontend/lib/shopping/` (Vitest only includes `lib/**/*.test.ts`, node env).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active-list uniqueness / lazy create | Database | API | Race safety must be a DB constraint; API does the upsert-style insert |
| Ownership authorization of lists/items | API / Backend | -- | Every query scoped by `userId` through the list; never trust client ids |
| Merge on generate (name+unit sum) | API / Backend | -- | Must be atomic and server-side so two devices cannot double-merge |
| Item cap, bounds, sanitization | API / Backend | Browser (UX hints) | Server is authority; client only mirrors limits for friendly errors |
| Grouping, sorting, totals display | Browser / Client | -- | Pure derived view of the list; pure helpers, unit-testable |
| Finish -> history row, carry-over | API / Backend | -- | Multi-row write, must be one transaction |
| Optimistic check-off | Browser / Client | API | Cache write + rollback on error; API is source of truth |
| Screen wake lock | Browser / Client | -- | Browser-only API; feature-detected |
| Currency formatting / parsing | Browser / Client | -- | Phase 3 `useCurrency` / `parseMajorToCents`; backend stores integer cents only |

## Standard Stack

No new dependencies are required. Everything below is already installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma / @prisma/client | 5.22.0 (pinned, STACK.md says stay) | ORM, migrations, `$transaction`, `$queryRaw` | Existing; `ai-quota.repository.ts` already uses raw `ON CONFLICT` |
| express-validator | existing | Request validation | Pantry/mealplan pattern |
| Jest + supertest + ts-jest | existing | Backend tests (temp Postgres; CI service container) | `backend/jest.config.js` |
| @tanstack/react-query | ^5.90.8 | Server state, optimistic updates | Existing providers |
| Vitest | 5.0.3 | Pure-helper tests | `frontend/vitest.config.ts` (include `lib/**/*.test.ts`, env `node`) |
| @radix-ui/react-dialog (via `components/ui/modal.tsx`) | ^1.1.15 | Edit sheet, finish sheet | Phase 3 shared `Modal` bottom sheet |
| lucide-react, react-hot-toast | existing | Icons, undo toast | Existing |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `decimal.js` runtime exported as `Decimal` from `@prisma/client/runtime/library` | Build Decimal values for `quantity` | Same import as `pantry.service.ts` line 18 |
| `node:crypto` `randomUUID` | Primary key for raw INSERT | Raw insert bypasses Prisma's client-side `@default(uuid())` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `ON CONFLICT` for lazy create | Prisma `create` + catch `P2002` then `findFirst` | Also race-safe, but P2002 meta target for partial indexes is not modeled; raw is verified and mirrors `ai-quota.repository.ts` |
| `@radix-ui/react-collapsible` / accordion | Button with `aria-expanded` + conditional render (or native `<details>`) | **Neither Radix collapsible nor accordion is installed** (only dialog, dropdown-menu, select, tabs, toast). Do not add a package for this; a 15-line `CategorySection` is enough |
| Prisma 7.4 `partialIndexes` preview | Raw SQL migration | Out of scope: STACK.md pins Prisma 5.22 |

**Installation:** none.

## Package Legitimacy Audit

No external packages are added in this phase; audit not applicable.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | -- | -- | -- | -- | -- | -- |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Phone / browser (Next.js, React Query)
  |  GET active list            POST/PATCH/DELETE item     POST generate{mealPlanId}   POST finish{carryOver}   GET history
  v
Express app.ts -> [global apiLimiter: SKIP /api/v1/shopping] -> shoppingLimiter -> authenticate -> validators -> controller
  |
  v
ShoppingService (all writes in prisma.$transaction)
  |-- ensureActiveList(tx,userId): INSERT ... ON CONFLICT (user_id) WHERE active DO NOTHING; SELECT ... FOR UPDATE
  |-- items: count<=300 check, ownership via list.userId, Decimal<->number mapping
  |-- generate: MealPlanService.generateShoppingList(userId, planId) -> merge key lower(trim(name))+lower(trim(unit)) -> sum qty / insert
  |-- finish: lock list -> total = sum(checked: actual ?? estimate ?? 0) -> mark completed -> ShoppingHistory row -> carry unchecked to fresh list OR drop
  v
Postgres: shopping_lists (partial unique idx), shopping_list_items, shopping_history
```

### Recommended Project Structure
```
backend/
  prisma/migrations/20261011000000_shopping_active_list_unique/migration.sql
  src/modules/shopping/
    shopping.routes.ts      # authenticate + validators
    shopping.controller.ts  # thin, asyncHandler
    shopping.service.ts     # transactions, ensureActiveList, merge, finish
    shopping.merge.ts       # PURE: mergeKey, mergeIntoItems (unit-testable, no Prisma)
    shopping.dto.ts         # toItemDto / toListDto (Decimal -> number)
    shopping.validation.ts  # express-validator chains + constants (limits)
    shopping.constants.ts   # MAX_ITEMS_PER_LIST etc.
  src/types/shopping.types.ts
  tests/shopping.test.ts, tests/shopping-merge.test.ts
frontend/
  lib/shopping/{grouping,totals,merge,normalize}.ts + *.test.ts   # pure, vitest-included
  lib/api/shopping.ts (rewrite)  types/shopping.types.ts (rewrite)
  lib/hooks/use-shopping-list.ts, use-wake-lock.ts
  components/shopping/{quick-add,shopping-item-row,category-section,item-edit-sheet,summary-bar,finish-sheet,generate-from-plan}.tsx
  app/(app)/shopping/page.tsx
```
Keep every file under 400 lines (user rule: 200-400 typical, 800 max).

### Pattern 1: Race-safe lazy create of the active list
**What:** One primitive used by every read-write path.
**Verified:** On a throwaway Postgres 16, with the partial unique index in place, the statement inserts once and the second identical statement returns `INSERT 0 0`.
```ts
// Source: verified locally against Postgres 16 (see Sources); pattern mirrors backend/src/modules/ai/ai-quota.repository.ts
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

async function ensureActiveListId(tx: Prisma.TransactionClient, userId: string): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO shopping_lists (id, user_id, name, updated_at)
    VALUES (${randomUUID()}, ${userId}, 'Shopping list', now())
    ON CONFLICT (user_id) WHERE is_completed = false AND deleted_at IS NULL
    DO NOTHING`;
  // Lock the row so concurrent add/generate/finish on the same list serialize
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM shopping_lists
    WHERE user_id = ${userId} AND is_completed = false AND deleted_at IS NULL
    FOR UPDATE`;
  return rows[0].id;
}
```
Notes: `id` and `updated_at` have no DB defaults (Prisma supplies them client-side), so the raw INSERT must provide both. `created_at` and `is_completed` have DB defaults. The `ON CONFLICT` predicate must textually imply the index predicate (same conditions as the index).

Read path (`GET active`): do `ensureActiveListId` inside a transaction, then `findUnique` with `include: { shoppingListItems }`. Do not create on GET if you want pure reads, but CONTEXT says GET creates lazily; it is cheap (one no-op INSERT).

### Pattern 2: Migration with partial unique index and defensive dedupe
```sql
-- Additive. Idempotent like 20261010010000_zapier_webhooks.
-- 1) Defensive: if any user somehow has several active lists, complete all but the newest.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id) AS rn
  FROM "shopping_lists"
  WHERE "is_completed" = false AND "deleted_at" IS NULL
)
UPDATE "shopping_lists" s
SET "is_completed" = true, "completed_at" = now(), "updated_at" = now()
FROM ranked r WHERE s.id = r.id AND r.rn > 1;

-- 2) One active list per user. Prisma 5.22 cannot model this; it is ignored by migrate diff (verified).
CREATE UNIQUE INDEX IF NOT EXISTS "shopping_lists_one_active_per_user"
  ON "shopping_lists" ("user_id")
  WHERE "is_completed" = false AND "deleted_at" IS NULL;
```
Completing (rather than deleting) duplicates preserves user data. Creating the migration: write the folder by hand with a timestamp later than `20261010010000` (existing migrations use 2026-dated names, e.g. `20261010010000_zapier_webhooks`); do not run `migrate dev` against it.

**Drift check (verified empirically, Prisma 5.22.0, Postgres 16):**
- `prisma migrate diff --from-url <db with index> --to-schema-datamodel prisma/schema.prisma --exit-code` returned "No difference detected", exit 0.
- `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <shadow> --exit-code` with a migration containing the partial index also returned exit 0.
- `prisma migrate status` reports up to date.
So: no schema change is required and CI (`prisma migrate deploy`) is unaffected. Add a comment above `model ShoppingList` in `schema.prisma` naming the index and its SQL so the next developer knows it exists. (If the project ever moves to Prisma >= 7.4, the `partialIndexes` preview feature can model it; not now.) [CITED: prisma.io docs and prisma-engines notes found via search; local verification is the authority here]

### Pattern 3: Decimal -> number serialization
Prisma returns `Decimal` for `quantity`; `res.json` emits it as a string (pantry already ships `quantity: string`). The frontend `ShoppingListItem.quantity` is typed `number`, so map explicitly in one place:
```ts
export const toItemDto = (i: ShoppingListItem) => ({ ...i, quantity: i.quantity.toNumber() });
```
`Decimal(10,2)` max is 99,999,999.99, exactly representable range-wise as a double, so `toNumber()` is safe. Validate quantity `isFloat({ gt: 0, max: 99999 })` (pick a business max well below the column limit) and round to 2 dp in the service before `new Decimal(q)`.

### Pattern 4: Merge into the active list (server-side, pure + transactional)
- Pure function `mergeKey(name, unit) = trim().toLowerCase()` of both joined by a separator that cannot appear (e.g. `\u0000`), used by `mergeIntoItems(existing[], incoming[]) -> { updates, inserts }` so it is unit-testable without Prisma.
- Sum quantities in integer hundredths (`Math.round(q*100)`) to avoid float drift, then convert back to 2 dp.
- Only merge into existing items that are **not checked** (a checked item is already in the cart; adding a new unchecked line for the extra amount is the least surprising). Flag this as a planner decision (Assumption A3); if the user wants strict "sum identically", just ignore `isChecked`.
- On merge, keep the existing item's category/estimate/notes; for generated inserts use `category = inferCategory(name)` (see pitfalls) else `'other'`.
- Run inside the same `$transaction` after `ensureActiveListId` (row lock) and enforce the cap on `existingCount + inserts.length`; reject with `AppError(..., 400, true, { code: 'SHOPPING_LIST_FULL' })` before writing anything.
- Response: `{ list, summary: { added, merged } }` so the UI can toast "12 added, 3 merged".

### Pattern 5: Finish
In one transaction: lock the active list; reject empty list (`code: 'SHOPPING_LIST_EMPTY'`); compute `total = sum over CHECKED items of (actualCostCents ?? costEstimateCents ?? 0)` (Assumption A2); clamp to `MAX_HISTORY_TOTAL_CENTS = 2_000_000_000` (int4 max is 2,147,483,647; matches `MAX_BUDGET_CENTS` in `frontend/lib/currency/budget.ts`); set `isCompleted=true, completedAt=now, totalCostCents=total`; insert `ShoppingHistory { userId, shoppingListId, receiptDate: today (UTC date), totalPhpCents: total }`; if `carryOver !== 'discard'` (default `'carry'`), create a fresh active list via `ensureActiveListId` (it is free now because the old list is no longer active) and `createMany` copies of unchecked items (unchecked, same fields, actual cost cleared). Return `{ history, list: <new active list> }`.
`totalPhpCents` holds minor units of the user's currency (all currencies are stored as major x 100, including JPY/KRW/IDR, see `parseMajorToCents`). Document with a comment in the service and a Prisma schema comment; do not rename (column rename = migration risk and analytics/alert services read this field).
Downstream readers exist: `analytics.service.ts` (lines ~47, 240, 384) and `alert.service.ts` (~245) already aggregate `shoppingHistory.totalPhpCents`; finishing a list now feeds the budget/analytics pages automatically, so history rows must be correct integers.

### Pattern 6: Undo delete
Items have no `deletedAt`, so DELETE hard-deletes. Simplest robust undo: `DELETE /items/:id` returns the deleted item DTO; the toast "Undo" action calls `POST /items` with the same fields (including `isChecked`, `actualCostCents`, `costEstimateCents`, `notes`, `category`), producing a new id. Therefore the create validator must accept `isChecked`, `actualCostCents`, `costEstimateCents`. Item loses original `createdAt` ordering (acceptable; sort by category then `createdAt`/name). No server-side restore endpoint needed. Keep the optimistic removal in the cache and re-insert on undo.

### Pattern 7: Optimistic check-off with React Query 5
Per the official guide (cancelQueries, snapshot, setQueryData, rollback in onError, invalidate in onSettled) [CITED: tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates]. Additions for rapid tapping in an aisle:
- Use a `mutationKey: ['shopping','item']` and invalidate only when `queryClient.isMutating({ mutationKey }) === 1` in `onSettled` so an earlier response does not flicker over a later tap (the "concurrent optimistic updates" caveat the docs point to).
- The mutation updates the list immutably (`items.map(i => i.id === id ? { ...i, ...patch } : i)`), per the user's immutability rule.
- Per-query options: `staleTime: 30_000`, `refetchOnWindowFocus: true` for the active-list query only (global default is `refetchOnWindowFocus: false`, `staleTime` 5 min, which would make a second device look stale). Add `queryKeys.shopping.active()` and `queryKeys.shopping.history(page)` to `frontend/lib/react-query.ts` (existing `lists()/detail()` keys can stay or be removed).
- `retry: 0` is already the mutation default; surface failures with `getApiErrorMessage` from `frontend/lib/api/errors.ts`.

### Pattern 8: Wake Lock hook
```ts
// frontend/lib/hooks/use-wake-lock.ts  (TypeScript 5.9.3 lib.dom already declares navigator.wakeLock / WakeLockSentinel)
'use client';
import { useEffect, useRef, useState } from 'react';

export function useWakeLock(enabled: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!enabled || !supported) return;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel.current) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) { void s.release(); return; }
        sentinel.current = s;
        setActive(true);
        s.addEventListener('release', () => { sentinel.current = null; setActive(false); });
      } catch { /* low battery, policy, iOS standalone bug: fail silently */ }
    };
    void acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel.current?.release();
      sentinel.current = null;
      setActive(false);
    };
  }, [enabled, supported]);

  return { supported, active };
}
```
Facts: the sentinel is auto-released when the document becomes hidden, so it must be re-requested on `visibilitychange`; a released sentinel cannot be reused; `request()` can reject (power saver, low battery, inactive doc); requires a secure context [CITED: developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API]. Support: Baseline 2025 in browsers; iOS Safari 16.4+, but installed home-screen web apps did not get it until a later iOS (sources say iOS 18.4; MDN snapshot disagrees) [MEDIUM, Assumption A4]. UI: show a small "Screen stays on" indicator only when `active`; hide/disable the claim when unsupported. Do not use video/NoSleep hacks. SSR safety: the hook reads `navigator` only in guarded paths; `supported` computed at render must not break hydration, so compute it in an effect/`useSyncExternalStore` or gate rendering of the indicator on `active`.

### Anti-Patterns to Avoid
- **Client-supplied list id as authority.** Always resolve the list from `userId`; item routes verify `item.shoppingList.userId === userId && deletedAt null && !isCompleted`. Use `updateMany/deleteMany` with `where: { id, shoppingList: { userId, ... } }` and 404 on `count === 0` (prevents id probing, no existence leak).
- **Check-then-insert for the active list.** Not race-safe; use the raw ON CONFLICT primitive.
- **Float math for money or quantity merge.** Integer cents; quantities summed as hundredths.
- **Hand-rolled collapsible dependency.** Don't add a package.
- **Returning Prisma `Decimal` straight to JSON** (string) when the frontend type says `number`.
- **Mutating arrays/objects in place** in merge/grouping helpers (user rule: immutability).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| One-active-list guarantee | App-level "find then create" | Partial unique index + `ON CONFLICT DO NOTHING` | Only the DB closes the race between two devices |
| Ingredient aggregation from a meal plan | A second aggregation | `MealPlanService.generateShoppingList` (refactor lightly) | Already computes servings multiplier and rounding |
| Money parsing/formatting | New regex/Intl code | `parseMajorToCents`, `parseBudgetInput`, `useCurrency().format`, `centsToMajorString` | Phase 3 strict parser, no float math |
| Modal/bottom sheet | New dialog | `components/ui/modal.tsx` | Phase 3 UI-SPEC rules already baked in |
| Empty/error states | New markup | `components/common/empty-state.tsx` | Existing; supports secondary action |
| Error body extraction | New axios handling | `getApiErrorMessage` / `getApiErrorCode` (`lib/api/errors.ts`) | Existing |
| Request validation | Manual checks | express-validator chains + the `validate` wrapper pattern | Matches pantry/mealplan modules |
| Debounce/optimistic rollback | Custom store | React Query `onMutate/onError/onSettled` | Official pattern |

**Key insight:** the risky part is concurrency and boundary values (two devices, rapid taps, big numbers), not CRUD. Put the guarantees in the database and in pure, tested helpers.

## Runtime State Inventory

Not a rename/refactor phase, but one migration-style concern applies:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Possibly pre-existing `shopping_lists` rows (no module wrote them; likely none). Production DB may have been created via `db push` and the shopping tables exist from the initial migration (verified in `20251112125700_initial_schema`). | Defensive dedupe `UPDATE` in the migration (completes extra active lists); no data deletion |
| Live service config | None (no external service holds shopping config) | None |
| OS-registered state | None | None |
| Secrets/env vars | None new | None |
| Build artifacts | `frontend` `sessionStorage['current-shopping-list']` in users' open tabs (`USER_SCOPED_STORAGE_KEYS`) | Keep the key in the cleanup list so logout still clears it; on first load, best-effort: ignore/drop it (recommended: drop; its shape is `{mealPlanName, items:[{ingredientName,quantity,unit,recipes}]}` and has no check state worth saving), and `removeItem` once the new page mounts |

## Common Pitfalls

### Pitfall 1: Global rate limiter starves the shopping page (HIGH impact)
**What goes wrong:** `app.use('/api/', apiLimiter)` is 100 requests / 15 min / IP for everything (`rateLimiter.ts`). A 40-item trip with a tap per item, a refetch on focus, and normal navigation can exceed it; users get 429 mid-aisle, optimistic taps roll back.
**How to avoid:** Add `shoppingLimiter` (e.g. 600 per 15 min, key via `ipKeyGenerator`, same JSON body shape) mounted on the shopping router, and make `apiLimiter` skip shopping paths: `skip: (req) => req.originalUrl.startsWith('/api/v1/shopping')` (note: inside `app.use('/api/', ...)` `req.path` is relative to the mount, so use `originalUrl`). Keep `tests/rate-limiter.test.ts` green and add a test that the skip works. Also consider not refetching after every check-off (see Pattern 7).
**Warning signs:** 429s in smoke or manual testing.

### Pitfall 2: Existing aggregation truncates names containing ":"
**What goes wrong:** `mealplan.service.ts` builds the map key as `` `${name.toLowerCase()}:${unit}` `` and later does `key.split(":")[0]` to recover the name. An ingredient like "salt: coarse" is cut to "salt", and units/names collide. Names are also always lower-cased.
**How to avoid:** When reusing, store `{ ingredientName, unit }` in the map value and stop re-deriving from the key (small, safe refactor; keep the public response shape `{ items:[{ingredientName, quantity, unit, recipes}], totalEstimatedCostCents? }`, covered by `tests/mealplan.test.ts`). Also the key uses a case-sensitive `unit` while name is lowercased; normalize both with `trim().toLowerCase()`.
**Also note:** `totalEstimatedCostCents` there is the meal plan's `totalCostCents` (a plan-level figure, not per item). Do NOT copy it onto items; per-item estimates stay null unless the user enters them. Recipe ingredients carry no category or price, so generated items get `category` via a small pure `inferCategory(name)` keyword map (protein/vegetable/fruit/dairy/grains/spices/canned/frozen/beverages/condiments, else `other`). Without it SHOP-04 grouping is useless for generated lists. Keep the map small and tested; it is a hint, the user can edit category.

### Pitfall 3: Category/unit vocabularies are inconsistent
**What goes wrong:** Backend `PantryCategory` has 11 values (protein, vegetable, fruit, dairy, grains, spices, canned, frozen, beverages, condiments, other) and `PantryUnit` is lbs, kg, grams, oz, cups, ml, liters, tsp, tbsp, fl_oz, pieces, items. `frontend/lib/constants/categories.ts` `PANTRY_CATEGORIES` only has 7 (no canned/frozen/beverages/condiments), and `lib/constants/units.ts` uses `g`, `lb`, `piece`, `unit`, `l`, `cup`, `fl-oz`, `dozen`... (the `pcs` mismatch noted in CONTEXT). The pantry modals define the correct 11 categories and 12 units inline. `frontend/types/shopping.types.ts` `ShoppingItemCategory` (produce, snacks...) matches neither.
**How to avoid:** Create `frontend/lib/shopping/vocab.ts` exporting `SHOPPING_CATEGORIES` (all 11 values + labels + a fixed display order with `other` last) and `SHOPPING_UNITS` (the 12 API values), derived from the pantry modal lists, and use only those in the quick-add/edit sheet. Do not use `ALL_UNITS` from `units.ts`. Backend validates `unit` with `isIn(Object.values(PantryUnit))` and `category` with `isIn(Object.values(PantryCategory))`; unknown or blank category normalizes to `other` server-side (accept absent/null/'' as other, reject unknown strings with 400; generated items are mapped through `inferCategory`). Default unit for quick-add with no unit: `pieces`; default quantity 1. Note meal-plan recipe ingredient units are free strings (`RecipeIngredient.unit`), so generate must NOT reject unknown units: preserve the recipe's unit text (the `unit` column is a plain `String`; use `pieces` only when it is empty) while still validating `unit` strictly on manual create/update. Document this asymmetry; Phase 5 handles unit normalization.
**Warning signs:** Items from generate showing a blank or odd unit in the unit select (select must tolerate a value outside the list; render it as a read-only label).

### Pitfall 4: int4 overflow in history totals
`ShoppingHistory.totalPhpCents`, `ShoppingList.totalCostCents`, per-item cents are all Postgres `Int` (max 2,147,483,647). 300 items at a large per-item cap can overflow a naive sum. Fix: per-item cap `MAX_ITEM_CENTS = 200_000_000` (2,000,000 major units; IDR/KRW/JPY users enter large numbers, so do NOT use a tight cap like 7,000,000) and clamp the sum to 2_000_000_000 in JS (Number, safe: 300 x 2e8 = 6e10 < 2^53) before the insert. Validation: `isInt({ min: 0, max: MAX_ITEM_CENTS })`. Frontend mirrors with `parseBudgetInput`-style bound check (a `parseItemPriceInput` helper using `parseMajorToCents` plus the cap).

### Pitfall 5: Rapid-tap optimistic flicker and lost updates
Responses for tap N can invalidate/refetch and overwrite optimistic state for tap N+1. Use the `isMutating === 1` invalidate guard and `cancelQueries` in `onMutate` (Pattern 7). PATCH is idempotent (sets `isChecked` to a value, not toggle): send the target boolean, never "toggle".

### Pitfall 6: Soft-deleted/completed lists still reachable by id
Any item route must join through the list and require `deletedAt: null` and `isCompleted: false`. Otherwise a finished list's items stay editable. Also `ShoppingHistory.shoppingListId` FK is `SET NULL` on delete; fine.

### Pitfall 7: Prisma `updateMany` returns no row
Use `updateMany` for ownership-safe write then re-read with `findFirst`, or do `findFirst` (scoped) -> `update` inside the transaction holding the list lock. Don't `update({ where: { id } })` alone (no ownership).

### Pitfall 8: Error shape
`errorHandler.ts` only emits `code` and `error` when the thrown `AppError` has a `code` (`new AppError(msg, status, true, { code })`). To satisfy "consistent error shape (`message`, `error`, `code`)" always pass a `code` for domain errors (`SHOPPING_LIST_FULL`, `SHOPPING_ITEM_NOT_FOUND`, `SHOPPING_LIST_EMPTY`, `MEAL_PLAN_NOT_FOUND`). The `validate` wrapper in pantry throws `AppError("Validation failed: ...", 400)` without a code; pass `{ code: 'VALIDATION_ERROR' }` in the shopping copy (or share one helper rather than copy-paste a third time).

### Pitfall 9: Mount / route conflicts
Register `app.use('/api/v1/shopping', shoppingRoutes)` in `backend/src/app.ts` (uses `require(...)` + `console.log` style there; follow it). Old frontend constants use `/shopping-lists`; update `frontend/lib/constants/api-routes.ts` `SHOPPING` and `lib/api/shopping.ts` together. Place static paths (`/history`, `/generate`, `/finish`, `/items`) before any `/:id` routes.

### Pitfall 10: Vitest scope
`frontend/vitest.config.ts` includes only `lib/**/*.test.ts` in the `node` environment (no jsdom, no React Testing Library). So testable frontend logic must live as pure functions under `frontend/lib/`; component behavior is verified by lint/type-check/build plus the manual check. Do not plan component unit tests unless Wave 0 adds jsdom (not recommended; out of scope).

### Pitfall 11: Stale cached list across accounts
`clearUserSessionState` calls `queryClient.clear()` on logout, which covers the React Query cache. Keep `current-shopping-list` in `USER_SCOPED_STORAGE_KEYS`. If wake-lock/shopping-mode preference is persisted in localStorage, add its key to that list too (recommended: do not persist shopping mode, keep it in component state).

## Code Examples

### Totals (pure, frontend/lib/shopping/totals.ts)
```ts
export interface PricedItem { costEstimateCents: number | null; actualCostCents: number | null; isChecked: boolean }
export interface Totals { estimatedCents: number; actualCents: number; differenceCents: number | null; itemsWithActual: number }

export function computeTotals(items: readonly PricedItem[]): Totals {
  let estimatedCents = 0, actualCents = 0, itemsWithActual = 0, estimateOfActuals = 0;
  for (const i of items) {
    estimatedCents += i.costEstimateCents ?? 0;
    if (i.actualCostCents !== null) {
      actualCents += i.actualCostCents; itemsWithActual += 1;
      estimateOfActuals += i.costEstimateCents ?? 0;
    }
  }
  // Compare like with like: difference only over items that have an actual price
  return { estimatedCents, actualCents, itemsWithActual,
           differenceCents: itemsWithActual > 0 ? actualCents - estimateOfActuals : null };
}
```
Rationale: CONTEXT says "estimated total, actual total (of items with actuals) and difference". Comparing the actual total against the estimated total of ALL items would always look "under budget" mid-trip, so the difference is computed over items that have both (A5). Keep this decision visible to the planner.

### Grouping (pure)
Sort groups by `CATEGORY_ORDER` with unknown -> `other` last; within a group unchecked first (stable by `createdAt`/name), checked last. Return new arrays; never sort in place (`[...items].sort`).

### Item PATCH validator sketch
```ts
body('itemName').optional().trim().notEmpty().isLength({ max: 100 }) // no escape(), see note
body('quantity').optional().isFloat({ gt: 0, max: 99999 })
body('unit').optional().isIn(Object.values(PantryUnit))
body('category').optional({ nullable: true }).isIn(Object.values(PantryCategory))
body('isChecked').optional().isBoolean({ strict: true })
body('costEstimateCents').optional({ nullable: true }).isInt({ min: 0, max: 200_000_000 })
body('actualCostCents').optional({ nullable: true }).isInt({ min: 0, max: 200_000_000 })
body('notes').optional({ nullable: true }).trim().isLength({ max: 500 })
param('itemId').isUUID()
```
Sanitization note: existing modules `trim()` only and rely on React escaping on output. Do not HTML-`escape()` stored data (it corrupts "&" in names like "Mac & cheese" and double-escapes in React); store the trimmed plain string, collapse internal whitespace, strip control characters, and rely on React's escaping. Require at least one updatable field on PATCH (400 otherwise).

### Generate endpoint contract
`POST /api/v1/shopping/generate` body `{ mealPlanId: uuid }` -> 200 `{ list, added, merged }`; 404 `MEAL_PLAN_NOT_FOUND` for another user's/unknown plan (reuse the service's scoped `findFirst`, which already throws 404 "Meal plan not found"; wrap or pass a code); empty plan -> 400 `MEAL_PLAN_EMPTY`. Also set `ShoppingList.mealPlanId` to the plan if the list was empty/new (informational; with merges from several plans leave the latest or null; recommend leave null to avoid false attribution unless list was just created).

### Recommended endpoint set (all under `/api/v1/shopping`, all `authenticate`d)
| Method/Path | Purpose |
|-------------|---------|
| GET `/list` | Active list + items (lazy create) |
| POST `/items` | Add item (also used for undo) |
| PATCH `/items/:itemId` | Edit/check/price |
| DELETE `/items/:itemId` | Remove, returns the removed item |
| POST `/generate` | Merge meal plan ingredients |
| POST `/finish` | `{ carryOver?: 'carry' \| 'discard' }`, writes history |
| GET `/history?page&limit` | Paginated completed trips (`receiptDate desc`, limit max 50) |
Use the repo's response style: bare JSON objects (pantry/mealplan return the object directly), pagination as `{ items, pagination: { page, limit, total, totalPages } }` matching the existing `ShoppingListsResponse`/pantry shape. (The global "API Response Format" envelope in user rules is not what this codebase uses; stay consistent with the codebase.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sessionStorage` list from meal plan | Server-stored active list | This phase | Survives reload and devices |
| Prisma: partial indexes via raw SQL only | Prisma >= 7.4 `partialIndexes` preview | 2026-02 (v7.4.0) | Not usable here (Prisma 5.22 pinned) |
| NoSleep video hack for wake lock | `navigator.wakeLock` | Baseline 2025 | Use the API; fail silently when unsupported |

**Deprecated/outdated:** `frontend/lib/api/shopping.ts` and `types/shopping.types.ts` target `/shopping-lists` endpoints that never existed (multi-list shape, `ShoppingListsResponse`, `CreateShoppingListData`); rewrite rather than adapt. `ShoppingItemCategory` type (produce/snacks) is wrong, replace with the pantry category union.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Production DB has no duplicate active lists (no code ever wrote them) | Pattern 2 | Low: migration dedupes defensively anyway |
| A2 | "Total" for the history row = sum over CHECKED items of `actual ?? estimate ?? 0` (per-item fallback; unchecked/carried-over items excluded). CONTEXT says "sum of actual costs, falling back to estimates when no actuals", which is ambiguous between per-item and whole-list fallback, and silent on unchecked items | Pattern 5 | Medium: history/analytics numbers differ from user expectation; confirm with user in discuss or plan-check |
| A3 | Merge only into unchecked existing items; a checked match gets a new unchecked line | Pattern 4 | Low: UX surprise only; one-line change |
| A4 | Wake Lock works in iOS home-screen PWAs only from ~iOS 18.4 (sources conflict); works in Safari tab from 16.4 | Pattern 8 | Low: silent fallback; covered by the deferrable real-phone check |
| A5 | Estimated-vs-actual "difference" is computed over items that have an actual price | Code Examples | Low/Medium: UI semantics; trivial to change |
| A6 | `inferCategory` keyword map is acceptable scope (CONTEXT says unknown = Other, does not mention inference) | Pitfall 2 | Low: if rejected, all generated items land in "Other" and grouping benefit is reduced for generate |
| A7 | Shopping limiter of ~600 req / 15 min / IP is adequate | Pitfall 1 | Low: tunable constant |

## Open Questions

1. **History total semantics (A2).** What we know: per-item fallback over checked items is the most defensible reading. Unclear: whether the user wants unchecked-but-priced items included. Recommendation: implement A2, state it in the finish sheet copy ("Total of checked items").
2. **Does the Meal Plans page "Generate shopping list" card (`app/(app)/mealplans/page.tsx` `handleGenerateShoppingList`, shows a preview via `getShoppingList`) also get an "Add to my list" action?** Recommendation: yes, a single "Add to shopping list" button calling `POST /generate`, since the shopping page also lists plans; keep the preview GET endpoint unchanged (it is the source for `generate`).
3. **Dashboard widgets:** grep shows no dashboard widget reading shopping data (only a `ShoppingCart` icon); no change required. Optional: an unchecked-count badge; defer.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres for backend tests | Jest + supertest | Not running locally; Homebrew `postgresql@16` binaries present | 16 | CI service container (postgres:16-alpine). Locally: `initdb` + `pg_ctl -o "-p 54329"` (what this research used) and set `DATABASE_URL`, then `prisma migrate deploy` |
| Docker | docker-build CI job / local DB | Daemon not running locally | CLI 29.7.2 | Use Homebrew Postgres; CI handles docker |
| Node / npm | all | Present (used above) | -- | -- |
| Prisma CLI | migration, drift check | Present | 5.22.0 | -- |
| Railway CLI | deploy step | Not probed this session; STACK.md records 5.45.10 installed | [ASSUMED] | Dashboard deploy |
| curl, jq | `scripts/smoke-prod.sh` | Script already requires them | -- | -- |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | Jest 29-style via ts-jest, supertest; `backend/jest.config.js`, setup `tests/setup.ts`, real Postgres via `DATABASE_URL` |
| Frontend framework | Vitest 5.0.3, `frontend/vitest.config.ts` (`lib/**/*.test.ts`, env node) |
| Quick run (backend) | `cd backend && npx jest tests/shopping --coverage=false` |
| Full suite (backend) | `cd backend && npm test -- --ci` |
| Quick run (frontend) | `cd frontend && npx vitest run lib/shopping` |
| Full suite (frontend) | `cd frontend && npm run lint && npm run type-check && npm test && npm run build` |

Backend test conventions to copy (from `tests/pantry.test.ts`): sign up a unique user via `/api/v1/auth/signup`, use the returned `token`, delete rows in `afterAll` (delete `shoppingHistory`, `shoppingListItem` via cascade, `shoppingList`, then users matched by email substring). Use distinct email prefixes (`shopping-test`, `shopping-other`) because Jest runs test files in parallel workers sharing one DB. Note `jest.config.js` has `resetMocks/restoreMocks: true`.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-01 | GET list lazily creates exactly one active list; second GET returns same id | integration | `npx jest tests/shopping.test.ts -t "lazy create"` | Wave 0 |
| SHOP-01 | 20 concurrent GETs/POST items for a new user yield one active list (partial unique index) | integration | `... -t "concurrent"` | Wave 0 |
| SHOP-01 | Direct second active insert violates the index; migration dedupe SQL completes extras | integration (raw SQL) | `... -t "one active"` | Wave 0 |
| SHOP-01 | Requires auth (401); user B cannot see/patch/delete user A's item (404) | integration | `... -t "ownership"` | Wave 0 |
| SHOP-01 | List persists across "device change" (new request with same token returns saved items and check state) | integration | `... -t "persist"` | Wave 0 |
| SHOP-02 | POST item (valid, defaults, unit/category validation, qty/cents bounds, name length, 300 cap -> 400 `SHOPPING_LIST_FULL`) | integration | `... -t "POST /items"` | Wave 0 |
| SHOP-02 | PATCH item (check, edit, prices, empty body 400, unknown id 404) and idempotent check | integration | `... -t "PATCH"` | Wave 0 |
| SHOP-02 | DELETE returns item; re-POST restores (undo) | integration | `... -t "DELETE"` | Wave 0 |
| SHOP-02 | Quantity returned as number, 2 dp | integration | `... -t "decimal"` | Wave 0 |
| SHOP-03 | Generate adds ingredients; second generate merges (sum qty, same name+unit, case-insensitive) and returns `added/merged` | integration | `... -t "generate"` | Wave 0 |
| SHOP-03 | Other user's meal plan -> 404; ingredient with ":" in name survives | integration + mealplan regression | `npx jest tests/mealplan.test.ts tests/shopping.test.ts` | partial |
| SHOP-03 | Pure `mergeIntoItems` (case, trim, hundredths sum, checked items not merged, no mutation) | unit | `npx jest tests/shopping-merge.test.ts` | Wave 0 |
| SHOP-04 | Pure grouping/ordering: category order, other last, checked sink, unknown -> other | unit (vitest) | `npx vitest run lib/shopping/grouping.test.ts` | Wave 0 |
| SHOP-04 | `inferCategory` keyword map | unit | backend jest or vitest depending on where it lives | Wave 0 |
| SHOP-04 | Wake lock: acquire/release/visibility | manual-only (real phone; hook needs a browser API) | Phase checkpoint | n/a |
| SHOP-05 | `computeTotals` (nulls, actual subset, difference over like-with-like) | unit (vitest) | `npx vitest run lib/shopping/totals.test.ts` | Wave 0 |
| SHOP-05 | Finish: history row (receiptDate today, total = checked actual??estimate), list completed, new list lazily on next add, carry vs discard, empty list 400, clamp at 2e9 | integration | `... -t "finish"` | Wave 0 |
| SHOP-05 | History endpoint pagination + ownership | integration | `... -t "history"` | Wave 0 |
| (cross) | `/api/v1/shopping` not throttled by the 100/15min global limiter; shopping limiter returns 429 past its cap | integration | `npx jest tests/rate-limiter.test.ts tests/shopping.test.ts` | extend existing |
| (cross) | `prisma migrate diff --from-migrations ... --exit-code` stays 0 | CI/shell | see command below | add as plan verification step |
| (cross) | Prod smoke: signup smoke user, GET list, POST item, PATCH check, generate (optional), finish, history | smoke | `API=... scripts/smoke-prod.sh --api-only` | extend script |

Drift check command (shadow DB must be a separate empty database):
`npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL" --exit-code`

### Sampling Rate
- **Per task commit:** the quick-run command for the touched side.
- **Per wave merge:** backend `npm run lint && npm run type-check && npm test -- --ci`; frontend lint, type-check, vitest.
- **Phase gate:** both full suites plus `next build` green; `smoke-prod.sh` shopping checks pass against Railway before pushing the frontend.

### Wave 0 Gaps
- [ ] `backend/tests/shopping.test.ts` (integration, covers SHOP-01/02/03/05)
- [ ] `backend/tests/shopping-merge.test.ts` (pure merge and `inferCategory`)
- [ ] `frontend/lib/shopping/{grouping,totals,merge,normalize}.test.ts`
- [ ] Extend `tests/rate-limiter.test.ts` for the shopping exemption
- [ ] No framework installs needed

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `authenticate` middleware on the whole router |
| V3 Session Management | no change | Existing JWT handling |
| V4 Access Control | yes (critical) | Scope every query by `userId` via the list; 404 (not 403) on foreign ids; tests for cross-user access |
| V5 Input Validation | yes | express-validator (types, enums via `Object.values(PantryCategory/PantryUnit)`, bounds, `isUUID` params, max lengths); strict boolean; reject unknown enum strings |
| V6 Cryptography | no | None (UUIDs via `crypto.randomUUID`) |
| V11 Business logic | yes | Item cap 300 enforced under row lock; clamp totals; rate limit |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on item/list ids | Info disclosure / Tampering | Ownership join in every query; `updateMany/deleteMany` with scoped where; 404 |
| SQL injection via raw INSERT | Tampering | Tagged-template `$executeRaw`/`$queryRaw` only (parameterized); never `$queryRawUnsafe` |
| Unbounded growth (items, huge numbers) | DoS | 300-item cap, name <= 100, notes <= 500, qty and cents caps, 1 MB body limit already set in `app.ts` |
| Stored XSS in item names | Tampering / XSS | Store plain trimmed text, React escapes on render; never `dangerouslySetInnerHTML`; CSP already restrictive |
| Race to exceed cap or duplicate lists | Tampering | Row lock (`FOR UPDATE`) + partial unique index |
| Rate-limit evasion / starvation | DoS | Dedicated shopping limiter keyed with `ipKeyGenerator`; trust proxy = 2 already configured |
| Error detail leakage | Info disclosure | `errorHandler` hides raw messages in production; do not include Prisma errors in responses |

## Sources

### Primary (HIGH confidence)
- Repository code read this session: `backend/prisma/schema.prisma`, `backend/src/app.ts`, `backend/src/middleware/{errorHandler,rateLimiter}.ts`, `backend/src/modules/{pantry,mealplan}/*`, `backend/src/modules/ai/ai-quota.repository.ts` (pattern), `backend/tests/{pantry.test.ts,setup.ts}`, `backend/jest.config.js`, `.github/workflows/ci.yml`, `backend/entrypoint.sh`, `scripts/smoke-prod.sh`, frontend `lib/api/*`, `lib/react-query.ts`, `components/providers.tsx`, `components/ui/modal.tsx`, `lib/currency/*`, `lib/constants/*`, `lib/auth/session-cleanup.ts`, pantry modals, `vitest.config.ts`, `package.json`.
- Local experiments against a throwaway Postgres 16 with this repo's migrations and Prisma 5.22.0: partial unique index creation, `ON CONFLICT (user_id) WHERE ... DO NOTHING` (second insert = 0 rows), `migrate diff --exit-code` exit 0 with and without migration-borne partial index, `migrate status` up to date.
- MDN Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- TanStack Query v5 optimistic updates: https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates

### Secondary (MEDIUM confidence)
- Prisma unsupported database features and partial index status (v7.4 `partialIndexes` preview; prisma-engines fix for manually created partial indexes): https://www.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features , https://github.com/prisma/prisma/issues/14651 (found via search; not needed given local verification)
- iOS wake lock support and home-screen bug (WebKit bug 254545): https://bugs.webkit.org/show_bug.cgi?id=254545 , https://progressier.com/pwa-capabilities/screen-wake-lock (sources disagree on fix version; see A4)

### Tertiary (LOW confidence)
- None relied on.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new packages; all existing and read from package.json)
- Architecture / DB behavior: HIGH (verified empirically)
- Frontend patterns: MEDIUM-HIGH (official docs; UI untested until built)
- Pitfalls: HIGH (rate limiter, aggregation bug, vocab mismatch read directly from code)
- Wake lock on iOS standalone: MEDIUM (sources conflict)

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (stable stack; Prisma pinned)
