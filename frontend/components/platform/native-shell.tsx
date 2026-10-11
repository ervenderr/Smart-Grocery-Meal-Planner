'use client';

import { useEffect } from 'react';
import { isNative, loadPlugin } from '@/lib/platform/native';
import { createSplashHider } from '@/lib/platform/splash';
import { shouldDismissKeyboard } from '@/lib/platform/keyboard-dismiss';

const INTERACTIVE_SELECTOR =
  'button,a,label,input,textarea,select,[role="button"],[contenteditable="true"]';
const SPLASH_FADE_MS = 200;

function logError(scope: string, error: unknown): void {
  console.error(`${scope} failed:`, error instanceof Error ? error.message : 'unknown');
}

async function safely(scope: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logError(scope, error);
  }
}

/** Native startup: status bar, keyboard, splash, html classes. Renders nothing. */
export function NativeShell() {
  useEffect(() => {
    if (!isNative()) return;

    const html = document.documentElement;
    const cleanups: Array<() => void> = [];
    let cancelled = false;
    html.classList.add('native');

    const splashPlugin = loadPlugin(() => import('@capacitor/splash-screen'));
    const hider = createSplashHider({
      hide: async () => {
        const mod = await splashPlugin;
        await mod?.SplashScreen.hide({ fadeOutDuration: SPLASH_FADE_MS });
      },
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number),
    });
    hider.start();
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => hider.firstPaint()));
    cleanups.push(() => cancelAnimationFrame(raf));

    void safely('StatusBar', async () => {
      const mod = await loadPlugin(() => import('@capacitor/status-bar'));
      if (!mod) return;
      // Style.Light = dark text for light backgrounds.
      await mod.StatusBar.setStyle({ style: mod.Style.Light });
      await mod.StatusBar.setOverlaysWebView({ overlay: true });
    });

    void safely('Keyboard', async () => {
      const mod = await loadPlugin(() => import('@capacitor/keyboard'));
      if (!mod) return;
      const { Keyboard } = mod;
      await Keyboard.setAccessoryBarVisible({ isVisible: false });
      const handles = await Promise.all([
        Keyboard.addListener('keyboardWillShow', () => html.classList.add('keyboard-open')),
        Keyboard.addListener('keyboardWillHide', () => html.classList.remove('keyboard-open')),
        Keyboard.addListener('keyboardDidShow', () => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && active.closest('[role="dialog"]')) {
            active.scrollIntoView({ block: 'center' });
          }
        }),
      ]);
      const onTouch = (event: TouchEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const info = {
          tagName: target.tagName,
          isContentEditable: target instanceof HTMLElement ? target.isContentEditable : false,
          closestInteractive: target.closest(INTERACTIVE_SELECTOR) !== null,
        };
        if (shouldDismissKeyboard(info, html.classList.contains('keyboard-open'))) {
          void safely('Keyboard.hide', () => Keyboard.hide());
        }
      };
      document.addEventListener('touchstart', onTouch, true);
      const remove = (): void => {
        document.removeEventListener('touchstart', onTouch, true);
        handles.forEach((h) => void h.remove());
      };
      if (cancelled) remove();
      else cleanups.push(remove);
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
