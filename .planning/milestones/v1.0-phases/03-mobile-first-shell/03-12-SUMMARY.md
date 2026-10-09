---
phase: 03-mobile-first-shell
plan: 12
subsystem: pwa
tags: [pwa, manifest, ios, icons, sharp, install-hint]
requires: ["03-01", "03-05", "03-11"]
provides:
  - "Web app manifest at /manifest.webmanifest"
  - "Brand PNG icons and opaque apple-touch-icon"
  - "iOS Safari 'Install Kitcha on your device' hint in the (app) shell"
affects: [03-13]
tech-stack:
  added: []
  patterns: ["pure detection helpers taking NavigatorLike", "try/catch storage wrappers", "eligibility read in timer callback to avoid SSR mismatch"]
key-files:
  created:
    - frontend/lib/pwa/detect-ios.ts
    - frontend/lib/pwa/storage.ts
    - frontend/lib/pwa/pwa.test.ts
    - frontend/scripts/generate-icons.mjs
    - frontend/public/icons/icon-192.png
    - frontend/public/icons/icon-512.png
    - frontend/public/icons/icon-maskable-512.png
    - frontend/public/icons/favicon-32.png
    - frontend/public/apple-touch-icon.png
    - frontend/app/manifest.ts
    - frontend/components/pwa/ios-install-hint.tsx
  modified:
    - frontend/app/layout.tsx
    - "frontend/app/(app)/layout.tsx"
key-decisions:
  - "No service worker and no new dependency; sharp used only by the one-off script (transitive of next)"
  - "Hint eligibility is computed inside the 2s timer callback, not a synchronous setState in an effect, satisfying react-hooks/set-state-in-effect"
requirements-completed: [MOB-04]
duration: ~15 min
completed: 2026-10-09
---

# Phase 3 Plan 12: PWA install support Summary

Kitcha is installable: a typed manifest, generated brand icons, apple-web-app metadata, and a dismissible iOS Safari "Add to Home Screen" hint mounted in the app shell.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 RED | 316f3e4 | failing tests (22 cases) |
| 1 GREEN | fcb6a15 | detect-ios.ts, storage.ts |
| 2 | 9df8251 | icons script + PNGs, manifest.ts, layout metadata |
| 3 | bc93f6c | IosInstallHint + (app)/layout mount |

## Verification

- `npm run lint` (0 errors, only pre-existing warnings), `type-check`, `npm test` (79 passed), `NEXT_PUBLIC_API_URL=https://x.example npx next build`: all exit 0.
- Icon check: sizes 192/512/512/32/180 correct; apple-touch-icon has 3 channels (no alpha).
- Visually inspected all five PNGs: none blank; mark centered; maskable is full-bleed blue with white flame; apple icon blue with white flame.
- `next start` served `/manifest.webmanifest` (200, `application/manifest+json`, valid JSON with expected fields); `/apple-touch-icon.png` 200; `/login` HTML contains manifest link, apple-mobile-web-app-title/status-bar-style, 32px PNG icon, svg icon and apple-touch-icon links. Server stopped afterward.

## Deviations from Plan

**1. [Rule 1 - Bug] apple-touch-icon retained alpha after `.flatten()`**
- sharp's flatten left a 4-channel PNG, so the no-alpha check failed. Added `.removeAlpha()` in the script and regenerated (3 channels). Committed in 9df8251.

**2. [Rule 1 - Lint] Hint effect structure**
- Initial two-effect version triggered `react-hooks/set-state-in-effect` warnings. Simplified to one `useEffect` with a timer whose callback evaluates eligibility; visibility is derived (`revealed && !onboardingShowing`). Behavior matches spec (2s delay, timer cleared on unmount, hidden while onboarding shows).

## Notes

- Icon artwork: the logo's pan is near-black (not `#0ea5e9`), so on the maskable/apple icons only the flame is recoloured white (per plan's string replace); the dark pan stays and reads clearly on blue.
- Next 16 emits `mobile-web-app-capable` (not `apple-mobile-web-app-capable`) for `appleWebApp.capable`; iOS honors it.
- Hint behavior in a real iOS Safari was not tested on-device (no device available); logic is covered by unit tests of the pure helpers only. The component itself has no unit test.
- No `git push`; STATE/ROADMAP/REQUIREMENTS untouched per orchestrator instruction.

## Known Stubs

None.

## Threat Flags

None. manifest.ts contains only static public branding.

## Self-Check: PASSED

All created files exist; commits 316f3e4, fcb6a15, 9df8251, bc93f6c present.
