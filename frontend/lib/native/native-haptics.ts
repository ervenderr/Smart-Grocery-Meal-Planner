import { isNative, loadPlugin } from '../platform/native';
import { createHaptics, type HapticEngine } from './haptics';
import { readHapticsEnabled } from './haptic-prefs';

function storage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

async function loadEngine(): Promise<HapticEngine | null> {
  const mod = await loadPlugin(() => import('@capacitor/haptics'));
  if (!mod) return null;
  const { Haptics, ImpactStyle, NotificationType } = mod;
  return {
    impactLight: () => Haptics.impact({ style: ImpactStyle.Light }),
    notifySuccess: () => Haptics.notification({ type: NotificationType.Success }),
    notifyWarning: () => Haptics.notification({ type: NotificationType.Warning }),
    selection: async () => {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    },
  };
}

/** App-wide haptic(kind), bound to @capacitor/haptics and the stored preference. */
export const haptic = createHaptics({
  isNative: () => isNative(),
  isEnabled: () => readHapticsEnabled(storage()),
  now: () => Date.now(),
  loadEngine,
});
