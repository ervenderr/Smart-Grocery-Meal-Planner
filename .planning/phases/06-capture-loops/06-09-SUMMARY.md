---
phase: 06-capture-loops
plan: 09
subsystem: pantry
tags: [pantry, barcode, scan-sheet, open-food-facts, vitest]
requires: ["06-01", "06-06"]
provides:
  - "normalizeBarcode / isValidBarcode, parseProductQuantity / prefillFromProduct / prefillFromOwnItem, resolveBarcode (pure, tested)"
  - "ScanSheet (full-screen Radix Dialog; manual, looking-up, unknown, failed states; modes lookup and return)"
  - "Scan entry points: pantry header icon, empty state, Add modal button, Edit modal scan icon"
affects: [06-11]
key-files:
  created:
    - frontend/lib/scan/barcode.ts
    - frontend/lib/scan/prefill.ts
    - frontend/lib/scan/resolve-barcode.ts
    - frontend/lib/scan/barcode.test.ts
    - frontend/lib/scan/prefill.test.ts
    - frontend/lib/scan/resolve-barcode.test.ts
    - frontend/components/pantry/scan/scan-sheet.tsx
    - frontend/components/pantry/scan/scan-states.tsx
    - frontend/components/pantry/scan/manual-barcode-form.tsx
  modified:
    - frontend/app/(app)/pantry/page.tsx
    - frontend/components/pantry/add-pantry-item-modal.tsx
    - frontend/components/pantry/edit-pantry-item-modal.tsx
requirements-completed: [CAP-01, CAP-02]
completed: 2026-10-09
---

# Phase 6 Plan 09: Barcode Lookup and Prefill Summary

Typing a barcode from any scan entry point now resolves (own pantry first, then Open Food Facts) to a prefilled Add form, or to amber unknown/failed cards that always lead to manual entry with the barcode kept; the Edit modal scan icon fills only the Barcode field.

## Commits
- f355bb4 test(06-09): add failing scan helper tests
- dc54b5f feat(06-09): add barcode normalize, prefill and resolution helpers (GREEN, 23 tests)
- 2510b84 feat(06-09): add scan sheet with manual lookup
- 34cf075 feat(06-09): wire barcode scan entry points and prefill

## Verification
- Frontend vitest 456/456, type-check clean, lint 0 errors; page.tsx 350 lines; no forbidden typography; no barcode-detector import.

## Deviations from Plan
- **[Design]** The "Scan barcode" button in the Add modal is rendered by the modal via a new `onScanBarcode` prop (instead of the page passing a `headerSlot` element), so the acceptance grep on the modal holds. `headerSlot` remains available.
- **[Design]** ScanSheet splits into a shell plus an inner `ScanBody` mounted only while open, so state resets to 'manual' on each open without a setState-in-effect (React Compiler lint warning).
- Edit modal renders its ScanSheet outside the `<form>` (as a sibling of Modal) because React portal events bubble to the outer form's onSubmit; it uses an internal default trailing button when `barcodeAction` is not supplied and sets the field directly rather than through `barcodeOverride`.
- Edit modal fragment content is not re-indented (avoids a whole-file diff).

## Known Stubs
None. `cameraAvailable` on ManualBarcodeForm is intentionally false until 06-11.

## Self-Check: PASSED
