import { describe, expect, it } from 'vitest';
import { mapCameraError, pickFirstDetection, supportsFormats } from './camera';

const withDevices = { hasMediaDevices: true };

describe('supportsFormats', () => {
  it('requires ean_13', () => {
    expect(supportsFormats(['qr_code'])).toBe(false);
    expect(supportsFormats(['ean_13', 'qr_code'])).toBe(true);
    expect(supportsFormats([])).toBe(false);
  });
});

describe('mapCameraError', () => {
  it('maps permission errors to denied', () => {
    expect(mapCameraError({ name: 'NotAllowedError' }, withDevices)).toBe('denied');
    expect(mapCameraError({ name: 'SecurityError' }, withDevices)).toBe('denied');
  });
  it('maps missing hardware to unavailable', () => {
    expect(mapCameraError({ name: 'NotFoundError' }, withDevices)).toBe('unavailable');
    expect(mapCameraError({ name: 'OverconstrainedError' }, withDevices)).toBe('unavailable');
    expect(mapCameraError('weird', withDevices)).toBe('unavailable');
  });
  it('maps in-use cameras to busy', () => {
    expect(mapCameraError({ name: 'NotReadableError' }, withDevices)).toBe('busy');
    expect(mapCameraError({ name: 'AbortError' }, withDevices)).toBe('busy');
  });
  it('is unavailable without mediaDevices regardless of error', () => {
    expect(mapCameraError({ name: 'NotAllowedError' }, { hasMediaDevices: false })).toBe(
      'unavailable'
    );
  });
});

describe('pickFirstDetection', () => {
  it('returns null for no usable result', () => {
    expect(pickFirstDetection([])).toBeNull();
    expect(pickFirstDetection([{ rawValue: 123 }])).toBeNull();
    expect(pickFirstDetection([{}])).toBeNull();
  });
  it('returns the first valid normalized barcode', () => {
    expect(pickFirstDetection([{ rawValue: 'abc' }, { rawValue: '036000291452' }])).toBe(
      '0036000291452'
    );
  });
});
