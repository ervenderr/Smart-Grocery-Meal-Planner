'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_MORE_ICON, NAV_PRIMARY, isActive, isMoreActive } from '@/lib/navigation';
import { isTextEntry } from '@/lib/dom/is-text-entry';
import { useNotificationStats } from '@/lib/notifications/use-notification-stats';
import { MoreSheet } from './more-sheet';

const SLOT_CLASS =
  'relative flex h-full w-full flex-col items-center justify-center gap-1 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500';

function SlotContent({
  icon: Icon,
  label,
  active,
  dot,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <>
      {active && (
        <span className="absolute left-1/2 top-0 h-1 w-8 -translate-x-1/2 rounded-b-full bg-primary-500" />
      )}
      <span
        className={`relative flex h-8 w-14 items-center justify-center rounded-full ${
          active ? 'bg-primary-50' : ''
        }`}
      >
        <Icon
          className={`h-6 w-6 ${active ? 'text-primary-600' : 'text-gray-500'}`}
          aria-hidden={true}
        />
        {dot && (
          <span className="absolute right-3 top-0 h-2 w-2 rounded-full bg-red-500">
            <span className="sr-only">unread alerts</span>
          </span>
        )}
      </span>
      <span
        className={`text-sm font-semibold ${active ? 'text-primary-700' : 'text-gray-500'}`}
      >
        {label}
      </span>
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { unread } = useNotificationStats();
  const [moreOpen, setMoreOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isTextEntry(event.target as Element | null)) setKeyboardOpen(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!isTextEntry(event.relatedTarget as Element | null)) setKeyboardOpen(false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const moreActive = moreOpen || isMoreActive(pathname);

  return (
    <>
      <nav
        aria-label="Primary"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-safe lg:hidden ${
          keyboardOpen ? 'hidden' : ''
        }`}
      >
        <div className="grid h-16 grid-cols-5">
          {NAV_PRIMARY.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={SLOT_CLASS}
              >
                <SlotContent icon={item.icon} label={item.label} active={active} />
              </Link>
            );
          })}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={SLOT_CLASS}
          >
            <SlotContent icon={NAV_MORE_ICON} label="More" active={moreActive} dot={unread > 0} />
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} unread={unread} />
    </>
  );
}
