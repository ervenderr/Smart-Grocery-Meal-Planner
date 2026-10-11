import type { NextConfig } from 'next';

export interface BuildEnv {
  readonly BUILD_TARGET?: string;
  readonly NEXT_PUBLIC_API_URL?: string;
  readonly NEXT_PUBLIC_E2E?: string;
  readonly NEXT_PUBLIC_SHOT?: string;
  // Allows passing process.env directly (weak-type detection otherwise rejects it).
  readonly [key: string]: string | undefined;
}

const NATIVE_PAGE_EXTENSIONS_E2E: readonly string[] = Object.freeze([
  'e2e.tsx',
  'tsx',
  'ts',
  'jsx',
  'js',
]);

const NATIVE_PAGE_EXTENSIONS_SHOT: readonly string[] = Object.freeze([
  'shot.tsx',
  'tsx',
  'ts',
  'jsx',
  'js',
]);

const isNativeTarget = (env: BuildEnv): boolean => env.BUILD_TARGET === 'native';

/** Throws a clear error when the native/e2e build flags are inconsistent. */
export function assertNativeEnv(env: BuildEnv): void {
  if (env.NEXT_PUBLIC_E2E === '1' && !isNativeTarget(env)) {
    throw new Error('NEXT_PUBLIC_E2E=1 is only allowed with BUILD_TARGET=native');
  }
  if (env.NEXT_PUBLIC_SHOT === '1' && !isNativeTarget(env)) {
    throw new Error('NEXT_PUBLIC_SHOT=1 is only allowed with BUILD_TARGET=native');
  }
  if (env.NEXT_PUBLIC_SHOT === '1' && env.NEXT_PUBLIC_E2E === '1') {
    throw new Error('NEXT_PUBLIC_SHOT=1 and NEXT_PUBLIC_E2E=1 cannot be combined');
  }
  if (!isNativeTarget(env)) return;
  const apiUrl = env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL must be set for native builds');
  }
  if (!apiUrl.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_API_URL must start with https:// for native builds');
  }
}

/**
 * Pure: returns a fresh Next config fragment. Web builds only pin NEXT_PUBLIC_NATIVE_BUILD=0 so
 * native-only dynamic imports are dead-code eliminated (no plugin chunks in the web bundle).
 */
export function buildNextOptions(env: BuildEnv): NextConfig {
  if (!isNativeTarget(env)) return { env: { NEXT_PUBLIC_NATIVE_BUILD: '0' } };
  const base: NextConfig = {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_NATIVE_BUILD: '1' },
  };
  if (env.NEXT_PUBLIC_E2E === '1') {
    return { ...base, pageExtensions: [...NATIVE_PAGE_EXTENSIONS_E2E] };
  }
  if (env.NEXT_PUBLIC_SHOT === '1') {
    return { ...base, pageExtensions: [...NATIVE_PAGE_EXTENSIONS_SHOT] };
  }
  return base;
}
