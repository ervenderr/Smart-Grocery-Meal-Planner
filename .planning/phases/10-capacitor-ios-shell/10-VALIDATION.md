---
phase: 10
slug: capacitor-ios-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-11
---

# Phase 10 - Validation Strategy

> Full requirement-to-test map lives in 10-RESEARCH.md "Validation Architecture". This file is the execution contract.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend, node environment, `lib/**/*.test.ts`); bash + simctl for native smoke |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run lib/<touched area>` |
| **Full suite command** | `cd frontend && npm test && npm run lint && npm run type-check` |
| **Native smoke** | `cd mobile && npm run build:ios && npm run e2e:ios` |
| **Estimated runtime** | unit ~20s; native build ~95s cold |

## Sampling Rate

- After every task commit: quick run + type-check
- After every wave: full suite + `cd frontend && npm run build` (web build unchanged)
- Before verify-work: full suite, native export build, `build:ios`, `e2e:ios` green
- Max feedback latency: 120s

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command |
|-------------|----------|-----------|-------------------|
| SHELL-01 | native export builds, web build unchanged, no server.url | build smoke + unit | native next build; `mobile/scripts/verify-bundle.sh`; vitest next-config |
| SHELL-02 | token store write-through, no localStorage token on native, survives relaunch | unit + simctl | vitest token-store, auth-store-native; e2e relaunch |
| SHELL-03 | scan adapter fallbacks | unit | vitest scan-adapter |
| SHELL-04 | reminder plan, permission-gated scheduler | unit + simctl | vitest reminders/*; e2e pending count |
| SHELL-05 | haptics wrapper, share text | unit + screenshots | vitest native/* |
| SHELL-06 | scripted build/install/launch and smoke E2E | script | `npm run build:ios`, `npm run e2e:ios` |

## Wave 0 Requirements

- [ ] `frontend/lib/auth/token-store.ts` + test
- [ ] `frontend/lib/platform/*` + tests
- [ ] `frontend/lib/scan/scan-adapter.ts` + test
- [ ] `frontend/lib/reminders/{plan,scheduler}.ts` + tests
- [ ] `frontend/lib/native/{haptics,share}.ts` + tests
- [ ] `mobile/` package, scripts

## Manual-Only Verifications (human_needed)

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Real barcode scan | SHELL-03 | No camera in Simulator |
| Haptic feel | SHELL-05 | No haptics in Simulator |
| Notification delivery at scheduled time | SHELL-04 | Needs device/time; signing needs user |
| Dynamic Island, keyboard on real iPhone | SHELL-05 | Device check |
| Signing team and run on iPhone | SHELL-01 | Requires user Apple ID in Xcode |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] No 3 consecutive tasks without automated verify
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set after checker pass
