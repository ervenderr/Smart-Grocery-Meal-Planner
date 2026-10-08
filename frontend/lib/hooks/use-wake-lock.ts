'use client';

import { useEffect, useState } from 'react';
import { createWakeLockController } from '@/lib/shopping/wake-lock';

export interface WakeLockState {
  readonly supported: boolean;
  readonly active: boolean;
}

/** Keeps the screen awake while `enabled`, where the Screen Wake Lock API exists. */
export function useWakeLock(enabled: boolean): WakeLockState {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const controller = createWakeLockController({
      navigator: globalThis.navigator,
      isVisible: () => document.visibilityState === 'visible',
      onChange: setActive,
    });

    const onVisibility = () => {
      void controller.handleVisibilityChange();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void controller.start().then(() => setSupported(controller.supported));

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void controller.stop();
      setActive(false);
    };
  }, [enabled]);

  return { supported, active: enabled && active };
}
