import type { CameraFailure } from './camera';
import type { CreatePantryItemData } from '@/types/pantry.types';

type FormValues = Partial<Record<keyof CreatePantryItemData, unknown>>;

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return !Number.isFinite(value) || value <= 0;
  return false;
}

/**
 * Patch to apply to a form that already has typed input: scanned values fill only
 * blank fields, but the scanned barcode always wins. Returns a new object.
 */
export function mergeScanIntoForm(
  current: FormValues,
  incoming: Partial<CreatePantryItemData>
): Partial<CreatePantryItemData> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (key === 'barcode' || isBlank(current[key as keyof CreatePantryItemData])) {
      patch[key] = value;
    }
  }
  return patch as Partial<CreatePantryItemData>;
}

/** Camera is offered unless the API is missing or the failure is permanent. */
export function isCameraAvailable(ctx: {
  hasMediaDevices: boolean;
  failure: CameraFailure | null;
}): boolean {
  if (!ctx.hasMediaDevices) return false;
  return ctx.failure !== 'denied' && ctx.failure !== 'unavailable';
}
