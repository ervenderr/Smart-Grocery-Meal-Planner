---
phase: 11-offline-core
plan: 06
subsystem: offline-connectivity
tags: [connectivity, transport, idempotency, offline-gate, tdd]
requires: [11-03, 11-05]
provides: [createConnectivity, probeHealth, attachNativeNetwork, forced-offline flag, createTransport, OfflineError gate]
affects: [11-08, 11-21]
key-files:
  created:
    - frontend/lib/offline/connectivity/connectivity.ts
    - frontend/lib/offline/connectivity/probe.ts
    - frontend/lib/offline/connectivity/forced-offline.ts
    - frontend/lib/offline/connectivity/native-network.ts
    - frontend/lib/offline/transport.ts
    - frontend/lib/api/offline-error.ts
  modified:
    - frontend/lib/api/client.ts
decisions:
  - "reportSuccess also clears a stale false OS hint (a successful request proves reachability)."
  - "Transport maps OfflineError (gate rejection) to a network failure; non-network/timeout failures call onSuccess since the server was reachable."
metrics:
  completed: 2026-10-11
---

# Phase 11 Plan 06: Connectivity, transport, offline gate Summary

Connectivity from the Capacitor network hint plus a 3 s `/health` probe (no navigator.onLine), an idempotent outbox transport with 8 s timeout and TransportFailure mapping, and an additive fail-fast OfflineError gate in apiClient (inert unless a gate is registered; web never registers one).

## Commits
- test: connectivity/probe/forced-offline/native-network (RED)
- feat: connectivity modules (GREEN)
- test: transport and offline gate (RED)
- feat: transport, offline-error, apiClient interceptor

## Verification
- `vitest run lib/offline lib/api`: 27 files, 216 tests passing (connectivity 28, transport + offline-error 14)
- Coverage of connectivity/** + transport.ts: 99.08% lines, 91.57% branches
- `tsc --noEmit` clean; lint 0 errors (124 warnings, pre-existing)
- No `navigator.onLine` in lib/offline; no non-type import of `@capacitor/network` (only the dynamic import in native-network.ts)

## Deviations from Plan
None of substance. Generated `frontend/coverage` was removed (it broke eslint) after measuring.

## Known Stubs
None. The gate is not registered anywhere yet; wiring happens in a later plan (11-08).

## Threat Flags
None. T-11-17..19 mitigated (E2E flag gated on NEXT_PUBLIC_E2E, timeouts, no body/header logging).

## Self-Check: PASSED
