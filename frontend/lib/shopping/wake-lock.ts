/** Minimal slice of WakeLockSentinel that the controller relies on. */
export interface WakeLockSentinelLike {
  addEventListener(type: 'release', listener: () => void): void;
  release(): Promise<void>;
}

export interface WakeLockNavigatorLike {
  readonly wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
}

export interface WakeLockControllerOptions {
  readonly navigator: WakeLockNavigatorLike;
  readonly isVisible: () => boolean;
  readonly onChange?: (active: boolean) => void;
}

export interface WakeLockController {
  readonly supported: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  handleVisibilityChange(): Promise<void>;
  isActive(): boolean;
}

/**
 * Screen Wake Lock controller with injectable browser objects. Failures and
 * missing support are silent. The browser auto-releases the lock when the tab
 * is hidden, so it is re-requested on the next visible change while wanted.
 */
export function createWakeLockController({
  navigator,
  isVisible,
  onChange,
}: WakeLockControllerOptions): WakeLockController {
  const api = navigator.wakeLock;
  const supported = typeof api?.request === 'function';

  let wanted = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let pending = false;

  const setSentinel = (next: WakeLockSentinelLike | null) => {
    const changed = (sentinel === null) !== (next === null);
    sentinel = next;
    if (changed) onChange?.(next !== null);
  };

  const acquire = async (): Promise<void> => {
    if (!supported || !api || !wanted || sentinel !== null || pending || !isVisible()) return;
    pending = true;
    try {
      const acquired = await api.request('screen');
      if (!wanted) {
        await acquired.release().catch(() => undefined);
        return;
      }
      acquired.addEventListener('release', () => {
        if (sentinel === acquired) setSentinel(null);
      });
      setSentinel(acquired);
    } catch {
      // Power saver, policy or unsupported context: silent fallback.
    } finally {
      pending = false;
    }
  };

  return {
    supported,
    isActive: () => sentinel !== null,
    async start() {
      wanted = true;
      await acquire();
    },
    async stop() {
      wanted = false;
      const held = sentinel;
      setSentinel(null);
      if (held) await held.release().catch(() => undefined);
    },
    async handleVisibilityChange() {
      await acquire();
    },
  };
}
