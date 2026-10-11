---
phase: 12-one-time-unlock
plan: 02
subsystem: backend
tags: [iap, apple, jws, verification, tdd]
requires: [12-01]
provides:
  - createAppleVerifier / AppleVerificationError / appleRootCertificates
  - Embedded Apple Root CA G3 with SHA-256 pin test
  - Offline test PKI + signer (signTestTransaction, signTestNotification, signWithChain, testVerifier)
affects: [12-06, 12-07]
tech-stack:
  added: ["@apple/app-store-server-library 3.1.0 (exact pin)"]
  patterns: [verifier per environment, typed log-safe errors, frozen results]
key-files:
  created:
    - backend/src/modules/entitlements/apple-root-g3.ts
    - backend/src/modules/entitlements/apple-verifier.ts
    - backend/scripts/gen-apple-test-pki.sh
    - backend/tests/fixtures/apple-test-pki/{root.der,chain.json,leaf.pk8.pem,README.md}
    - backend/tests/helpers/apple-test-signer.ts
    - backend/tests/apple-root-cert.test.ts
    - backend/tests/apple-verifier.test.ts
  modified:
    - backend/package.json
    - backend/package-lock.json
key-decisions:
  - "Xcode and LocalTesting both map to environment name 'Xcode' and require allowXcode"
  - "Notification environment is read from data.environment (unverified peek) only to choose the verifier; the library then verifies"
requirements-completed: [SUB-02]
completed: 2026-10-11
---

# Phase 12 Plan 02: Apple JWS verifier Summary

Injectable wrapper over Apple's SignedDataVerifier, with the Apple Root CA G3 embedded and pinned, and a deterministic offline test PKI/signer.

## Commits
- 6f2749e: library install, Apple root embed + pin test, test PKI generator and fixtures
- db0d8f8: RED tests and test signer
- 46a2f23: GREEN verifier implementation

## Package legitimacy check (T-12-SC)
`npm view @apple/app-store-server-library`: version 3.1.0 exists, repository `https://github.com/apple/app-store-server-library-node`, maintainer `appstoreserverlibraryautomation <app-store-server-library-auto@group.apple.com>`, no `install` or `postinstall` scripts. Installed with `--save-exact`. `npx prisma generate` re-run; Entitlement present in the client.

`npm audit --omit=dev`: 20 vulnerabilities (4 moderate, 15 high, 1 critical), all in pre-existing packages (axios, express, body-parser, qs, lodash, jws, path-to-regexp, etc.). None originate from the new dependency. Not addressed (out of scope).

Apple root verified: `CN=Apple Root CA - G3`, SHA-256 63:34:3A:BF:...:3E:91:79 matches the pinned value.

## Tests
- apple-verifier: 15 passed; apple-root-cert: 2 passed (17 total, 2 suites)
- apple-verifier.ts coverage: 89% statements, 81% branches, 92.9% functions, 94.4% lines
- `tsc --noEmit` clean; eslint clean on all touched files; no hand-rolled crypto in the verifier.

## Deviations from Plan
None. Notes: signer adds `signWithChain` and a `withoutTransaction` flag (needed for the untrusted-root and TEST-notification cases); the untrusted-root test regenerates a second PKI in a temp dir via the same script. Test timestamps use 2030-01-01 (within the 100-year cert validity). No jws-peek helper was needed (file is ~200 lines).

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
