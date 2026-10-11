---
phase: 10-capacitor-ios-shell
verified: 2026-10-11T00:00:00Z
status: human_needed
score: 6/6 requirements verified in code; device-only checks pending
re_verification: false
human_verification:
  - test: "Scan a real barcode with the native scanner on the iPhone"
    expected: "Native scanner opens, product resolves, manual entry still works if camera denied"
    why_human: "Camera/VisionKit needs a real device"
  - test: "Feel haptics (check shopping item, quantity step, cooked it, scan success)"
    expected: "Distinct haptic feedback"
    why_human: "Cannot be observed in Simulator"
  - test: "Schedule an expiring item, enable airplane mode, wait for delivery, tap notification"
    expected: "Local notification arrives; tap opens Pantry expiring filter"
    why_human: "Simulator could not grant notification permission; pending-count check unverified"
  - test: "Dynamic Island, keyboard clearance in bottom sheets, status bar legibility"
    expected: "No overlap or occlusion"
    why_human: "Visual, device-specific"
  - test: "Signing team setup, install and run on the connected iPhone; log in (CORS capacitor://localhost)"
    expected: "App launches and logs in against production API"
    why_human: "Needs Apple signing and a physical device"
---

# Phase 10: Capacitor iOS Shell Verification Report

**Goal:** Kitcha runs as a real iPhone app built from the existing frontend, with native scanning, secure login storage and local expiry notifications.
**Status:** human_needed (no code gaps found; real-iPhone items remain)

## Requirement Coverage

| Req | Status | Evidence |
|-----|--------|----------|
| SHELL-01 static-export Capacitor 8 project, no server dependency | VERIFIED | `mobile/capacitor.config.ts` has `webDir: ../frontend/out` and no `server`/`url` key (grep clean; synced iOS config also clean). `@capacitor/*` pinned 8.x in `mobile/package.json`. `frontend/lib/build/native-config.ts` emits `output: 'export'` only when `BUILD_TARGET=native`; web builds get `{}` (unchanged). Native requires https API URL. Summary reports simulator render of real UI (screenshots present). |
| SHELL-02 token in native secure storage, not localStorage | VERIFIED | `lib/auth/keychain-backend.ts` (SecureStorage, rejects when plugin missing), `lib/auth/native-boot.ts` scrubs legacy localStorage, `lib/stores/auth-persist.ts` `selectPersisted(native)` persists only `user`, wired in `auth-store.ts:92`. Relaunch persistence passed in e2e (Keychain, after ad-hoc signing fix). |
| SHELL-03 native scanner with manual fallback | VERIFIED in code / device pending | `components/pantry/scan/scan-sheet.tsx` uses native scan adapter (`lib/scan`) with manual path retained; e2e scan step ok. Real camera scan needs iPhone. |
| SHELL-04 on-device local notifications, opt-in flow | VERIFIED in code / device pending | `lib/reminders/*` (plan, prefs, permission-gated scheduler, native binding, route allowlist), `reminder-runtime`, explainer sheet, prompt card, settings all wired. Simulator permission could not be granted, so pending count and airplane-mode delivery are unverified. |
| SHELL-05 haptics, share sheet, safe area/keyboard | VERIFIED in code / device pending | Haptics wired in quantity-stepper, shopping-item-row, scan-sheet, settings; `lib/native/share*` used in `app/(app)/shopping/page.tsx`; Keyboard/StatusBar/Splash config plus native chrome plan 08. Feel and Dynamic Island need device. |
| SHELL-06 scripted build/install/launch + automated smoke E2E | VERIFIED | `mobile/scripts/{build-ios,sim-run,e2e-smoke,verify-bundle}.sh` and npm scripts exist; `e2e-artifacts/` holds multiple runs; summary records e2e:ios passing twice; E2E route gated out of release (`assertNativeEnv`, release export has no E2E markers). I did not re-run the simulator E2E. |

## Checks Run

| Check | Result |
|-------|--------|
| `npx vitest run lib/auth lib/reminders lib/scan lib/native lib/platform` | 19 files, 225 tests pass |
| `npx tsc --noEmit` (frontend) | clean |
| server.url in Capacitor config | absent |
| Secrets scan (mobile, frontend lib/components/app) | none committed; E2E credentials only passed via env at build time, generated per run |
| Tracked build output (`public`, env files, certs) in `mobile/` | none tracked |
| Web build unchanged | `buildNextOptions` returns `{}` for non-native; only additive `assertNativeEnv` guard |

## Anti-Patterns

No TBD/FIXME blockers surfaced in the scanned paths. Known remaining `window.location` uses are web-only or fallback (documented in 10-10 summary).

## Gaps

None. Roadmap marks Phase 10 with a human gate (real iPhone), so the items in the frontmatter are human_needed, not failures. Note: REQUIREMENTS.md still shows SHELL-01..06 as Pending and ROADMAP checkboxes are unchecked; update after the device pass.
