import { isNative, isNativeBuild } from '@/lib/platform/native';

/** Offline runtime is native-only; web stays untouched (D-08). */
export function isOfflineEnabled(): boolean {
  return isNative() && isNativeBuild();
}
