'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useIsOnline, useOfflineStatus } from '@/lib/offline/status/use-offline-status';

export const BANNER_SHOW_DELAY_MS = 2000;
export const BANNER_HIDE_DELAY_MS = 1000;
const BANNER_HEIGHT = '40px';
const CSS_VAR = '--offline-banner-h';

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setOpen(root.classList.contains('keyboard-open'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return open;
}

export function OfflineBanner() {
  const supported = useOfflineStatus() !== null;
  const online = useIsOnline();
  const keyboardOpen = useKeyboardOpen();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const timer = setTimeout(() => setVisible(!online), online ? BANNER_HIDE_DELAY_MS : BANNER_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [online, supported]);

  const shown = supported && visible && !keyboardOpen;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(CSS_VAR, shown ? BANNER_HEIGHT : '0px');
    return () => root.style.setProperty(CSS_VAR, '0px');
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      role="note"
      className="fixed inset-x-0 z-30 flex h-10 animate-slide-up items-center gap-2 bg-amber-100 px-4 text-sm text-amber-900 motion-reduce:animate-none bottom-[calc(64px+env(safe-area-inset-bottom))] lg:static lg:bottom-auto"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You&apos;re offline. Changes are saved on this device and will sync later.</span>
    </div>
  );
}
