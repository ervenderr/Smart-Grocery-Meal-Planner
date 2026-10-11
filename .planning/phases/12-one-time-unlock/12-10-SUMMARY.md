---
phase: 12-one-time-unlock
plan: 10
subsystem: frontend-entitlement-ui
tags: [storekit, settings, view-model, react-query, zustand]
requires: [12-04, 12-05]
provides:
  - ENTITLEMENT_COPY (all Kumaun Full strings, daily AI wording)
  - buildCardModel, buildUpgradeSheetModel, outcomeMessage (pure)
  - useUpgradeSheetStore, openUpgradeSheet (native-only), closeUpgradeSheet
  - useEntitlement hook (+ useStoreProduct, entitlement-cache)
  - KumaunFullCard, KumaunFullWebNote, Settings placement
affects: [12-11, 12-12]
key-files:
  created:
    - frontend/lib/entitlements/copy.ts
    - frontend/lib/entitlements/view-model.ts
    - frontend/lib/entitlements/upgrade-sheet-store.ts
    - frontend/lib/entitlements/entitlement-cache.ts
    - frontend/lib/hooks/use-entitlement.ts
    - frontend/lib/hooks/use-store-product.ts
    - frontend/components/settings/kumaun-full-card.tsx
    - frontend/components/settings/kumaun-full-web-note.tsx
  modified:
    - frontend/app/(app)/settings/page.tsx
key-decisions:
  - "Benefit and description copy says 'every day' (free AI has no monthly cap)"
  - "outcomeMessage takes an optional source arg so a failed restore shows restoreFailed rather than purchaseFailed"
  - "Entitlement localStorage cache is display-only placeholderData, keyed per user id"
requirements-completed: [SUB-01, SUB-03]
completed: 2026-10-11
---

# Phase 12 Plan 10: Entitlement UI state and Settings card Summary

Shared entitlement copy, pure view models, sheet store and `useEntitlement` hook, plus a native Settings "Kumaun Full" card (StoreKit price, Buy, Restore, aria-live messages) and a link-free web note.

## Commits
- 2cb3a8d: copy, view-model, upgrade-sheet store with tests
- fdc2de4: type fix in copy test
- 333a31a: useEntitlement, useStoreProduct, entitlement-cache (+ tests)
- 7730dfc: card, web note, Settings placement

## Tests
- `vitest run lib/entitlements lib/native/store`: 8 files, 67 tests passed (lib/entitlements alone: 30, including 27 new across copy, view-model, store and 3 cache tests; the rest are 12-05 helpers).
- `tsc --noEmit`: no errors in touched files. `npm run lint`: 0 errors (127 pre-existing warnings; one in settings/page.tsx effect is pre-existing).
- `mobile/scripts/frontend-build.sh native` and `web`: both exit 0.
- Acceptance greps: no `.sync(` in the hook; `recheckEntitlements` and `ENTITLEMENT_QUERY_KEY` present; no `href=` in card/note; no "each month" in copy.

## Deviations from Plan
- [Rule 3] Hook split into `use-entitlement.ts` (173 lines), `use-store-product.ts` and `lib/entitlements/entitlement-cache.ts` (+ test) to stay small; plan allowed the extraction. Refs are updated inside effects to satisfy the `react-hooks/refs` rule.
- `CardModel` gained `showTryAgain`; `outcomeMessage(outcome, source = 'purchase')` gained an optional second arg.
- Copy test used a non-callable union iteration that failed tsc; fixed in fdc2de4.
- A stray `cat > /dev/null` in one shell call hung until killed (no repo effect).
- Tests were written together with implementation and committed per task, not as separate RED/GREEN commits.

## Known issues (out of scope)
- `grep 9.99` acceptance: `frontend/lib/native/store/mock-store.ts` (12-04, E2E-only mock gated by NEXT_PUBLIC_E2E) contains a `$9.99` default price. It is not rendered by the card; no `9.99` exists in the files of this plan.
- Purchase and resume re-check behavior in the hook is covered by build/type checks and pure-logic tests only; there is no React-level test (vitest runs Node-only `lib/**`). Needs the 12-14/15 E2E.

## Known Stubs
None.

## Threat Flags
None. T-12-41..44 mitigated: price only from `localizedPrice`; web has no buttons or links; chip derives from `GET /entitlements/me` (cache is placeholder only); resume/online recheck never calls `sync`.

## Self-Check: PASSED
