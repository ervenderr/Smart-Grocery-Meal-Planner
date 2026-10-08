---
phase: 03-mobile-first-shell
plan: 05
subsystem: ui
tags: [nextjs, radix-dialog, react-query, mobile, navigation]
requires:
  - phase: 03-01
    provides: isTextEntry helper, safe-area utilities, vitest harness
provides:
  - Shared nav config (NAV_PRIMARY, NAV_MORE, NAV_SIDEBAR, isActive, isMoreActive, getPageTitle)
  - BottomNav and MoreSheet (below lg), sidebar only at lg
  - Compact 56px header with pt-safe outer wrapper
  - useLogout and useNotificationStats (single 30s poll) hooks
affects: [03-14 manual verification, 03-07 pages inside the shell]
tech-stack:
  added: []
  patterns: [single shared React Query poll, Radix Dialog bottom sheet, focusin/focusout keyboard hiding]
key-files:
  created:
    - frontend/lib/navigation.ts
    - frontend/lib/navigation.test.ts
    - frontend/lib/auth/use-logout.ts
    - frontend/lib/notifications/use-notification-stats.ts
    - frontend/components/dashboard/bottom-nav.tsx
    - frontend/components/dashboard/more-sheet.tsx
  modified:
    - frontend/app/(app)/layout.tsx
    - frontend/components/dashboard/dashboard-sidebar.tsx
    - frontend/components/dashboard/dashboard-header.tsx
    - frontend/components/dashboard/notifications-dropdown.tsx
    - frontend/components/notifications/notification-bell.tsx
    - frontend/components/notifications/notification-panel.tsx
key-decisions:
  - "Notification panel switched to flex-col with a flex-1 list so pt-safe/pb-safe do not break the old calc(100%-140px) height"
requirements-completed: [MOB-01, MOB-02, MOB-03]
duration: ~15min
completed: 2026-10-09
---

# Phase 3 Plan 05: Mobile Shell Summary

Bottom nav plus Radix "More" sheet below 1024px, sidebar only at lg, compact safe-area-aware header, h-dvh layout, and one shared 30s unread poll.

## Commits
- test(03-05): add failing navigation tests (RED)
- feat(03-05): add shared navigation config (GREEN, 10 tests pass)
- feat(03-05): add BottomNav, MoreSheet, logout and unread-stats hooks
- feat(03-05): wire mobile shell with bottom nav, compact header, lg sidebar

## Deviations from Plan
- [Rule 2 - Accessibility] Added aria-labels to the notification panel close, mark-all-read and dismiss buttons (icon-only) while making them 44px targets.
- [Rule 1 - Layout] Panel list height changed from `h-[calc(100%-140px)]` to flex-1 so the added safe-area padding does not cause overflow.
- Added `aria-label="Search"` to the desktop header search input (previously placeholder-only).

Otherwise executed as written.

## Verification
- `npm run lint` 0 errors (pre-existing warnings), `npm run type-check` 0, `npm test` 44 passed, `next build` exit 0.
- Early in the run, type-check showed errors only in plan 03-06's lib/currency RED tests; resolved by the time of the final gates.
- Manual 375px/1280px viewport check deferred to 03-14.

## Known Stubs
None.

## Self-Check: PASSED
