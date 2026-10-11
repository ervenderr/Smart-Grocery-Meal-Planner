'use client';

import { useSyncExternalStore } from 'react';
import { isNative, isNativeBuild } from './native';

export interface PlatformInfo {
  readonly native: boolean;
}

const subscribe = (): (() => void) => () => {};

/**
 * Server and hydration render use the build flag (no flash); after hydration the
 * value is confirmed against the Capacitor runtime.
 */
export function usePlatform(): PlatformInfo {
  const native = useSyncExternalStore(subscribe, isNative, isNativeBuild);
  return Object.freeze({ native });
}
