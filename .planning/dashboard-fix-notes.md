# Dashboard fix notes

Two production crashes on the Home tab were frontend/backend contract mismatches. The backend is the source of truth, so only the frontend was adapted (backend got contract tests only).

## Bug 1: "Something went wrong" when anything is expiring
- `GET /api/v1/pantry/expiring-soon` returns **flat** `PantryItem[]` (PantryService.formatItem), but the dashboard read `entry.item.id` / `entry.daysUntilExpiry`.
- Fix: new pure helper `frontend/lib/pantry/expiry.ts` (`getDaysUntilExpiry`, `getExpiryStatus`, `formatExpiryLabel`, `toExpiringItems`). Days are computed from the date-only `expiryDate` using UTC day numbers vs the viewer's local calendar date (no timezone/DST/time-of-day drift; invalid or null dates yield null and are dropped).
- `pantryApi.getExpiringSoon` now returns `PantryItem[]` (array-guarded); `ExpiringItem` is documented as a client-side view type. Dashboard maps through `toExpiringItems`. `PantryAnalytics` only used `.length`.

## Bug 2: "NaN remaining" and wrong colour
- `GET /analytics/dashboard` -> `budgetStatus` is a `BudgetComparison` `{budgetCents, actualSpentCents, differenceCents, percentageUsed, status: under/on/over_budget}`; the UI expected the alerts shape `{weeklyBudgetCents, spentThisWeekCents, remainingCents, status}`.
- Fix: `frontend/lib/analytics/budget.ts` (`budgetFromComparison`, `budgetFromAlertStatus`, `getBudgetHealth`, `formatPercent`). Health thresholds mirror the backend alert logic: warning at >= 90 (default `alertThresholdPercentage`), exceeded at >= 100 (AlertService uses >=, not >). Zero/missing budget (backend serialises Infinity/NaN as null) yields `null` -> "N/A" / "No budget data". Negative remaining is shown as "X over budget".
- Budget page and analytics page use `/alerts/budget/status` (shape was right) but crashed or produced NaN on `percentageUsed: null` / zero budget; both now go through `budgetFromAlertStatus`.

## Other mismatches found and fixed
- `/analytics/dashboard` really returns `{summary, recentTrends, topCategories, topItems, budgetStatus, savingsInsights}`; the page read `categoryBreakdown` and `totalSpentCents` (always undefined, so "No spending data" was always shown). Types and `normalizeDashboard` now match; the page uses `topCategories` and `summary.totalSpentCents`.
- spending-trends, category-breakdown, top-items, budget-comparison, price-trends and savings-insights all return an **envelope** (`{trends}`, `{categories}`, `{items}`, `{comparisons}`, `{ingredients}`, `{insights}`), but the client typed bare arrays, so the analytics/budget pages always rendered empty (`Array.isArray` fell back to `[]`). `unwrapList` in `lib/analytics/normalize.ts` fixes all clients. `SpendingTrend`, `TopItem`, `PriceTrend`, `SavingsInsight` types corrected.
- Analytics page: weekly budget is attached to the weekly trend points so the comparison chart has a budget; savings rate no longer divides by a zero budget.
- `PantryAnalytics` showed blank names (`item.name` -> `ingredientName`).
- Recipes / meal plans lists already match (`{items, pagination}`), no change.

## Tests
- Vitest: `lib/pantry/expiry.test.ts`, `lib/analytics/budget.test.ts`, `lib/analytics/normalize.test.ts` (fixtures mirror backend serializers).
- Jest (backend contract): `pantry.test.ts` asserts expiring-soon returns flat items with the expected keys; `analytics.test.ts` asserts the exact `budgetStatus` key set.
