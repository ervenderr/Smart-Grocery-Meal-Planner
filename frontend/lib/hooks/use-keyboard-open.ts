'use client';

import { useEffect, useState } from 'react';
import { isTextEntry } from '@/lib/dom/is-text-entry';
import { computeKeyboardOpen } from '@/lib/dom/keyboard-open';

/**
 * Tracks whether the on-screen keyboard is likely open. State is always derived
 * from document.activeElement and the visual viewport, never from event history,
 * so it cannot get stuck when a focused input unmounts or iOS skips a blur.
 * Re-evaluated on mount, route change (via `routeKey`), focus, pointer, visibility,
 * viewport resize and DOM mutations.
 */
export function useKeyboardOpen(routeKey: string): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const measure = () => Math.max(window.innerHeight, viewport?.height ?? 0);
    let baselineHeight = measure();
    let baselineWidth = window.innerWidth;
    let frame = 0;

    const evaluate = () => {
      frame = 0;
      const active = document.activeElement;
      const textEntryFocused =
        active instanceof HTMLElement &&
        active.isConnected &&
        document.visibilityState === 'visible' &&
        isTextEntry(active);

      if (window.innerWidth !== baselineWidth || !textEntryFocused) {
        // Rotation or no keyboard: the current size is the full-height baseline
        baselineWidth = window.innerWidth;
        baselineHeight = measure();
      }

      setOpen(
        computeKeyboardOpen({
          textEntryFocused,
          viewportHeight: viewport ? viewport.height : null,
          baselineHeight,
        })
      );
    };

    // Defer one frame so document.activeElement has settled after focus changes
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(evaluate);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    document.addEventListener('pointerdown', schedule, true);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);

    evaluate();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('pointerdown', schedule, true);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
    };
  }, [routeKey]);

  return open;
}
