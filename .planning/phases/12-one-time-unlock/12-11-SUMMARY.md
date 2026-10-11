---
phase: 12-one-time-unlock
plan: 11
subsystem: frontend-entitlement-ui
tags: [storekit, upgrade-sheet, modal, e2e-route]
requires: [12-04, 12-10]
provides:
  - UpgradeSheet, UpgradeSheetOffer, UpgradeSheetHost (native-only, mounted in app layout)
  - E2E/screenshot route app/e2e/upgrade (release-excluded)
key-files:
  created:
    - frontend/components/entitlements/upgrade-sheet.tsx
    - frontend/components/entitlements/upgrade-sheet-offer.tsx
    - frontend/components/entitlements/upgrade-sheet-host.tsx
    - frontend/app/e2e/upgrade/page.e2e.tsx
  modified:
    - frontend/app/(app)/layout.tsx
    - frontend/lib/hooks/use-entitlement.ts
requirements-completed: [SUB-01, SUB-03]
completed: 2026-10-11
---

# Phase 12 Plan 11: Upgrade sheet Summary

UI-SPEC Surface 2 upgrade sheet built on the shared Modal (dismissible via Close, Maybe later, overlay, swipe, Escape), mounted once for native only, plus a flag-gated `/e2e/upgrade` route for scripted E2E and review screenshots.

## Commits
- d40b15e: sheet, offer subcomponent, host, layout mount, hook fix
- 54901f6: E2E route

## Tests and verification
- `tsc --noEmit`: clean. `npm run lint`: 0 errors (130 warnings, pre-existing style).
- `vitest run lib/entitlements`: 6 files, 41 tests passed.
- `bash mobile/scripts/frontend-build.sh native --e2e`: exit 0, `out/e2e/upgrade` present.
- `bash mobile/scripts/frontend-build.sh native` (release rebuild): exit 0; `verify-bundle.sh`: "verify-bundle OK" (4684 KB); `test ! -e frontend/out/e2e/upgrade` true; `grep -rlF KITCHA_E2E_STORE_MOCK frontend/out` empty.
- Acceptance: 4 `upgrade-*` testids (sheet, buy, restore, dismiss); no `9.99` in components/entitlements; `{native && <UpgradeSheetHost />}` in layout.
- No React-level tests exist (vitest is Node-only for lib/**); interaction behavior needs the 12-14/15 E2E.

## Deviations from Plan
- [Rule 1 - Bug] `useEntitlement.notifyUnlocked` (12-10) closed the sheet and invoked `onUnlocked` immediately on unlock, so the "You're all set" state would never show. It now only fires the haptic; the host retries the pending add once (ref guard) when success is reached, and "Continue adding" closes. Removed the unused store import from the hook.
- Host mounts the inner sheet (and `useEntitlement`) only while open, so flow state resets per open.
- A successful restore from the sheet also shows the success state (the hook maps `restored` to idle flow, so the host tracks it).
- Offer content extracted to `upgrade-sheet-offer.tsx` as the plan allowed.
- The E2E route's `verify` mock includes `purchasedAt` to satisfy `VerifyResult`.

## Known Stubs
None.

## Threat Flags
None. T-12-45 mitigated (.e2e.tsx extension, runtime guard, verify-bundle and absence checks passed); T-12-46 (price only from StoreKit, restore always visible); T-12-47 (opens only via explicit `openUpgradeSheet`, five dismiss paths).

## Self-Check: PASSED
