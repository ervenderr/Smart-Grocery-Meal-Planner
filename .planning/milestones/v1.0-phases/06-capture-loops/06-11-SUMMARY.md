---
phase: 06-capture-loops
plan: 11
subsystem: pantry
tags: [barcode, camera, pwa, barcode-detector, vitest]
requires: ["06-02", "06-09"]
provides:
  - "camera.ts pure helpers (SCAN_FORMATS, supportsFormats, mapCameraError, pickFirstDetection)"
  - "useBarcodeScanner hook (only importer of barcode-detector, lazy ponyfill)"
  - "CameraView plus requesting/scanning/denied/unsupported states in ScanSheet"
key-files:
  created:
    - frontend/lib/scan/camera.ts
    - frontend/lib/scan/camera.test.ts
    - frontend/lib/scan/use-barcode-scanner.ts
    - frontend/components/pantry/scan/camera-view.tsx
  modified:
    - frontend/components/pantry/scan/scan-sheet.tsx
    - frontend/components/pantry/scan/scan-states.tsx
requirements-completed: [CAP-01, CAP-02]
completed: 2026-10-09
---

# Phase 6 Plan 11: Camera Barcode Scanning Summary

The scan sheet now opens the rear camera, detects barcodes natively (only when getSupportedFormats includes ean_13) or through the lazily imported barcode-detector ponyfill, and feeds the 06-09 lookup flow. Every camera failure leads to manual entry.

## Commits
- ae985c2 test(06-11): add failing camera helper tests (RED)
- b2408d4 feat(06-11): add barcode scanner hook with lazy ponyfill (GREEN)
- 3e503ff feat(06-11): add camera scanning to the scan sheet

## Verification
- vitest 478/478 pass, type-check clean, lint 0 errors in scan files, `next build` succeeds.
- Only `lib/scan/use-barcode-scanner.ts` references barcode-detector; no forbidden typography; files under 300 lines.
- Lazy chunk evidence: the ponyfill/ZXing JS is a separate chunk (`.next/static/chunks/374q_f8ucb7ii.js`, 41 KB) that is not referenced by the prerendered `/pantry` HTML initial scripts; the WASM binary loads from the CDN at first use.

## Deviations from Plan
- **[Design]** The detected-state "video frozen on last frame" and reticle pulse were not implemented: tracks are stopped on detection and the sheet moves to the white "Looking up" card. Low impact; revisit in 06-13 if device testing wants it.
- **[Design]** Sheet state 'scanning'/'denied'/'unsupported' are derived from the hook status (state stays 'requesting' while the camera is active); the union still includes the names.
- Prettier initially touched unrelated 06-09 files; reverted so only plan files are committed.

## Known Stubs
None. Real-device iOS behavior (ponyfill with HTMLVideoElement, A4 fallback via createImageBitmap) is unverified here and belongs to 06-13.

## Self-Check: PASSED
