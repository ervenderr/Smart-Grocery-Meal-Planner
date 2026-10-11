import { describe, it, expect, vi, afterEach } from 'vitest';
import { isNative, isNativeBuild, loadPlugin } from './native';

const nativeCap = { isNativePlatform: () => true };
const webCap = { isNativePlatform: () => false };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isNative', () => {
  it('is false on the server (no window)', () => {
    expect(isNative(nativeCap)).toBe(false);
  });

  it('reflects the capacitor platform in a browser', () => {
    vi.stubGlobal('window', {});
    expect(isNative(nativeCap)).toBe(true);
    expect(isNative(webCap)).toBe(false);
  });

  it('is false when capacitor throws', () => {
    vi.stubGlobal('window', {});
    expect(
      isNative({
        isNativePlatform: () => {
          throw new Error('boom');
        },
      })
    ).toBe(false);
  });
});

describe('isNativeBuild', () => {
  it('reads NEXT_PUBLIC_NATIVE_BUILD', () => {
    vi.stubEnv('NEXT_PUBLIC_NATIVE_BUILD', '1');
    expect(isNativeBuild()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_NATIVE_BUILD', '');
    expect(isNativeBuild()).toBe(false);
  });
});

describe('loadPlugin', () => {
  it('returns null without calling the loader on web', async () => {
    vi.stubGlobal('window', {});
    const loader = vi.fn().mockResolvedValue('plugin');
    await expect(loadPlugin(loader, webCap)).resolves.toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns the loader result on native', async () => {
    vi.stubGlobal('window', {});
    await expect(loadPlugin(async () => 'plugin', nativeCap)).resolves.toBe('plugin');
  });

  it('returns null and logs a message when the loader rejects', async () => {
    vi.stubGlobal('window', {});
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      loadPlugin(() => Promise.reject(new Error('missing')), nativeCap)
    ).resolves.toBeNull();
    expect(spy).toHaveBeenCalledWith('Native plugin load failed:', 'missing');
  });
});
