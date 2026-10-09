import { isValidBarcode, normalizeBarcode } from './barcode';

export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const;

export type CameraFailure = 'denied' | 'unavailable' | 'busy';

/** Native detection is trusted only when it can read EAN-13 (iOS Safari lacks it). */
export function supportsFormats(supported: readonly string[]): boolean {
  return supported.includes('ean_13');
}

function errorName(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return String((err as { name: unknown }).name);
  }
  return '';
}

export function mapCameraError(err: unknown, ctx: { hasMediaDevices: boolean }): CameraFailure {
  if (!ctx.hasMediaDevices) return 'unavailable';
  switch (errorName(err)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotReadableError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unavailable';
  }
}

/** First detection whose rawValue is a valid barcode, normalized; otherwise null. */
export function pickFirstDetection(results: readonly { rawValue?: unknown }[]): string | null {
  for (const result of results) {
    if (typeof result.rawValue !== 'string') continue;
    if (isValidBarcode(result.rawValue)) return normalizeBarcode(result.rawValue);
  }
  return null;
}
