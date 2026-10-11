export type HapticKind = 'light' | 'success' | 'warning' | 'selection';

export interface HapticEngine {
  impactLight(): Promise<void>;
  notifySuccess(): Promise<void>;
  notifyWarning(): Promise<void>;
  selection(): Promise<void>;
}

export const HAPTIC_THROTTLE_MS = 80;

export interface HapticDeps {
  isNative: () => boolean;
  isEnabled: () => boolean;
  now: () => number;
  loadEngine: () => Promise<HapticEngine | null>;
}

const METHOD: Record<HapticKind, keyof HapticEngine> = {
  light: 'impactLight',
  success: 'notifySuccess',
  warning: 'notifyWarning',
  selection: 'selection',
};

/** Builds a fire-and-forget haptic(kind): no-op on web or when disabled, throttled to 1 per 80 ms. */
export function createHaptics(deps: HapticDeps): (kind: HapticKind) => void {
  let lastFiredAt: number | null = null;
  let enginePromise: Promise<HapticEngine | null> | null = null;

  const getEngine = (): Promise<HapticEngine | null> => {
    enginePromise ??= deps.loadEngine().catch(() => null);
    return enginePromise;
  };

  return (kind) => {
    if (!deps.isNative() || !deps.isEnabled()) return;
    const now = deps.now();
    if (lastFiredAt !== null && now - lastFiredAt < HAPTIC_THROTTLE_MS) return;
    lastFiredAt = now;
    void getEngine()
      .then((engine) => engine?.[METHOD[kind]]())
      .catch((error: unknown) => {
        console.error('Haptic failed:', error instanceof Error ? error.message : 'unknown');
      });
  };
}
