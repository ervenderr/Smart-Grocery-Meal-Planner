'use client';

import { useEffect, useState } from 'react';
import { PlusSquare, Share, X } from 'lucide-react';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { shouldShowOnboarding } from '@/lib/onboarding/onboarding';
import { isIosSafari, isStandalone } from '@/lib/pwa/detect-ios';
import { HINT_DISMISSED_KEY, safeGetItem, safeSetItem, type StorageLike } from '@/lib/pwa/storage';

const HINT_DELAY_MS = 2000;

/** Accessing window.localStorage itself can throw (Safari private mode). */
function getLocalStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function canShowHint(): boolean {
  const standalone = isStandalone({
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
  });
  if (standalone || !isIosSafari(navigator)) return false;
  return safeGetItem(getLocalStorage(), HINT_DISMISSED_KEY) !== '1';
}

/** Manual "Add to Home Screen" instructions for iOS Safari (no install prompt exists there). */
export function IosInstallHint() {
  const { data } = usePreferences();
  const onboardingShowing = shouldShowOnboarding(data);
  const [revealed, setRevealed] = useState(false);

  // Eligibility is read client-side only, inside the timer callback (no SSR mismatch, no first paint).
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(canShowHint()), HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!revealed || onboardingShowing) return null;

  const dismiss = () => {
    safeSetItem(getLocalStorage(), HINT_DISMISSED_KEY, '1');
    setRevealed(false);
  };

  return (
    <section
      role="region"
      aria-label="Install instructions"
      className="fixed inset-x-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-40 animate-slide-up rounded-xl border border-gray-200 bg-white p-4 shadow-soft lg:inset-x-auto lg:bottom-4 lg:right-4 lg:max-w-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Install Kitcha on your device</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <ol className="mt-1 space-y-2 text-sm text-gray-600">
        <li className="flex items-center gap-2">
          <span>1. Tap the Share button</span>
          <Share className="h-4 w-4 text-primary-500" aria-hidden="true" />
        </li>
        <li className="flex items-center gap-2">
          <span>2. Choose Add to Home Screen</span>
          <PlusSquare className="h-4 w-4 text-primary-500" aria-hidden="true" />
        </li>
        <li>3. Tap Add</li>
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 min-h-11 rounded-lg px-3 text-sm font-medium text-primary-700 hover:bg-primary-50"
      >
        Dismiss hint
      </button>
    </section>
  );
}
