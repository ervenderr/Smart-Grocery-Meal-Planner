import { isValidBarcode, normalizeBarcode } from './barcode';
import type { CameraFailure } from './camera';

export interface NativeScannerLike {
  scanBarcode(options: Record<string, unknown>): Promise<{ ScanResult?: unknown; format?: unknown }>;
}

export interface DeviceLike {
  getInfo(): Promise<{ isVirtual?: boolean }>;
}

export type NativeScanOutcome =
  | { kind: 'code'; code: string }
  | { kind: 'cancelled' }
  | { kind: 'invalid' }
  | { kind: 'failure'; failure: CameraFailure };

export const NATIVE_SCAN_ERROR_COPY = "Couldn't read that barcode. Try again or enter the code instead.";

const UNAVAILABLE: NativeScanOutcome = { kind: 'failure', failure: 'unavailable' };

async function isVirtualDevice(device: DeviceLike | null): Promise<boolean> {
  if (!device) return false;
  try {
    return (await device.getInfo()).isVirtual === true;
  } catch {
    return false;
  }
}

function mapRejection(error: unknown): NativeScanOutcome {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/cancel/i.test(message)) return { kind: 'cancelled' };
  if (/denied|permission|not authorized/i.test(message)) return { kind: 'failure', failure: 'denied' };
  if (/in use|busy/i.test(message)) return { kind: 'failure', failure: 'busy' };
  console.error('Native scan failed:', message);
  return { kind: 'invalid' };
}

/** Normalizes the native scanner plugin result into the scan-sheet vocabulary. */
export async function scanNative(deps: {
  scanner: NativeScannerLike | null;
  device: DeviceLike | null;
  options: Record<string, unknown>;
}): Promise<NativeScanOutcome> {
  if (!deps.scanner) return UNAVAILABLE;
  if (await isVirtualDevice(deps.device)) return UNAVAILABLE;
  try {
    const result = await deps.scanner.scanBarcode(deps.options);
    const raw = typeof result?.ScanResult === 'string' ? result.ScanResult.trim() : '';
    if (raw === '') return { kind: 'cancelled' };
    if (!isValidBarcode(raw)) return { kind: 'invalid' };
    return { kind: 'code', code: normalizeBarcode(raw) };
  } catch (error) {
    return mapRejection(error);
  }
}
