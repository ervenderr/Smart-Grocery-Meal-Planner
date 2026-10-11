import { describe, it, expect } from 'vitest';
import { assertNativeEnv, buildNextOptions } from './native-config';

const API = 'https://x.example';

describe('buildNextOptions', () => {
  it('returns an empty config for the web build', () => {
    expect(buildNextOptions({})).toEqual({});
    expect(buildNextOptions({ BUILD_TARGET: 'web' })).toEqual({});
  });

  it('returns a fresh object each call', () => {
    expect(buildNextOptions({})).not.toBe(buildNextOptions({}));
  });

  it('enables static export for the native build', () => {
    const options = buildNextOptions({ BUILD_TARGET: 'native', NEXT_PUBLIC_API_URL: API });
    expect(options.output).toBe('export');
    expect(options.trailingSlash).toBe(true);
    expect(options.images?.unoptimized).toBe(true);
    expect(options.env?.NEXT_PUBLIC_NATIVE_BUILD).toBe('1');
    expect(options).not.toHaveProperty('pageExtensions');
  });

  it('adds the e2e page extension only for native e2e builds', () => {
    const options = buildNextOptions({
      BUILD_TARGET: 'native',
      NEXT_PUBLIC_API_URL: API,
      NEXT_PUBLIC_E2E: '1',
    });
    expect(options.pageExtensions).toEqual(['e2e.tsx', 'tsx', 'ts', 'jsx', 'js']);
  });

  it('does not share the e2e extension list between calls', () => {
    const env = { BUILD_TARGET: 'native', NEXT_PUBLIC_API_URL: API, NEXT_PUBLIC_E2E: '1' };
    const first = buildNextOptions(env).pageExtensions;
    const second = buildNextOptions(env).pageExtensions;
    expect(first).not.toBe(second);
  });
});

describe('assertNativeEnv', () => {
  it('accepts a web environment', () => {
    expect(() => assertNativeEnv({})).not.toThrow();
  });

  it('accepts a valid native environment', () => {
    expect(() => assertNativeEnv({ BUILD_TARGET: 'native', NEXT_PUBLIC_API_URL: API })).not.toThrow();
  });

  it('rejects native without an API url', () => {
    expect(() => assertNativeEnv({ BUILD_TARGET: 'native' })).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('rejects native with a non-https API url', () => {
    expect(() =>
      assertNativeEnv({ BUILD_TARGET: 'native', NEXT_PUBLIC_API_URL: 'http://x.example' })
    ).toThrow(/https/);
  });

  it('rejects the e2e flag outside a native build', () => {
    expect(() => assertNativeEnv({ NEXT_PUBLIC_E2E: '1' })).toThrow(/NEXT_PUBLIC_E2E/);
    expect(() => assertNativeEnv({ BUILD_TARGET: 'web', NEXT_PUBLIC_E2E: '1' })).toThrow(
      /NEXT_PUBLIC_E2E/
    );
  });
});
