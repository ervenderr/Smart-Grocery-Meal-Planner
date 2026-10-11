import { describe, expect, it, vi } from 'vitest';
import { NATIVE_SCAN_ERROR_COPY, scanNative, type NativeScannerLike } from './scan-adapter';

const device = (isVirtual: boolean) => ({ getInfo: vi.fn().mockResolvedValue({ isVirtual }) });
const scannerOk = (ScanResult: unknown): NativeScannerLike => ({
  scanBarcode: vi.fn().mockResolvedValue({ ScanResult }),
});
const scannerFail = (message: string): NativeScannerLike => ({
  scanBarcode: vi.fn().mockRejectedValue(new Error(message)),
});

describe('scanNative', () => {
  it('reports unavailable on a virtual device without calling the scanner', async () => {
    const scanner = scannerOk('4800016644801');
    const out = await scanNative({ scanner, device: device(true), options: {} });
    expect(out).toEqual({ kind: 'failure', failure: 'unavailable' });
    expect(scanner.scanBarcode).not.toHaveBeenCalled();
  });

  it('reports unavailable when scanner is null', async () => {
    expect(await scanNative({ scanner: null, device: null, options: {} })).toEqual({
      kind: 'failure',
      failure: 'unavailable',
    });
  });

  it('proceeds when device.getInfo rejects', async () => {
    const out = await scanNative({
      scanner: scannerOk('4800016644801'),
      device: { getInfo: vi.fn().mockRejectedValue(new Error('x')) },
      options: {},
    });
    expect(out).toEqual({ kind: 'code', code: '4800016644801' });
  });

  it('normalizes a valid code', async () => {
    const out = await scanNative({ scanner: scannerOk(' 4800016644801 '), device: device(false), options: {} });
    expect(out).toEqual({ kind: 'code', code: '4800016644801' });
  });

  it('pads UPC-A to EAN-13', async () => {
    const out = await scanNative({ scanner: scannerOk('036000291452'), device: null, options: {} });
    expect(out).toEqual({ kind: 'code', code: '0036000291452' });
  });

  it.each(['', undefined])('treats %s as cancelled', async (v) => {
    expect(await scanNative({ scanner: scannerOk(v), device: null, options: {} })).toEqual({ kind: 'cancelled' });
  });

  it('returns invalid for non-barcodes', async () => {
    expect(await scanNative({ scanner: scannerOk('hello'), device: null, options: {} })).toEqual({ kind: 'invalid' });
  });

  it('maps cancel rejections to cancelled', async () => {
    expect(await scanNative({ scanner: scannerFail('User CANCELLED'), device: null, options: {} })).toEqual({
      kind: 'cancelled',
    });
  });

  it.each(['Permission denied', 'not authorized', 'Access Denied'])('maps %s to denied', async (m) => {
    expect(await scanNative({ scanner: scannerFail(m), device: null, options: {} })).toEqual({
      kind: 'failure',
      failure: 'denied',
    });
  });

  it('maps busy errors to busy', async () => {
    expect(await scanNative({ scanner: scannerFail('Camera in use'), device: null, options: {} })).toEqual({
      kind: 'failure',
      failure: 'busy',
    });
  });

  it('maps other errors to invalid (not silent)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await scanNative({ scanner: scannerFail('boom'), device: null, options: {} })).toEqual({ kind: 'invalid' });
    spy.mockRestore();
  });

  it('passes options through unchanged', async () => {
    const scanner = scannerOk('4800016644801');
    const options = { hint: 17, scanButton: false };
    await scanNative({ scanner, device: null, options });
    expect(scanner.scanBarcode).toHaveBeenCalledWith(options);
  });

  it('exposes the error copy', () => {
    expect(NATIVE_SCAN_ERROR_COPY).toBe("Couldn't read that barcode. Try again or enter the code instead.");
  });
});
