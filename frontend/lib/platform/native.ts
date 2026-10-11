import { Capacitor } from '@capacitor/core';

export interface CapacitorLike {
  isNativePlatform(): boolean;
}

/** True in builds produced with BUILD_TARGET=native (inlined by Next at build time). */
export function isNativeBuild(): boolean {
  return process.env.NEXT_PUBLIC_NATIVE_BUILD === '1';
}

/** True only when running inside the Capacitor native shell (never on the server). */
export function isNative(cap: CapacitorLike = Capacitor): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return cap.isNativePlatform();
  } catch {
    return false;
  }
}

/** Dynamically loads a native-only plugin. Resolves null on web or on load failure. */
export async function loadPlugin<T>(
  loader: () => Promise<T>,
  cap: CapacitorLike = Capacitor
): Promise<T | null> {
  if (!isNative(cap)) return null;
  try {
    return await loader();
  } catch (error) {
    console.error('Native plugin load failed:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}
