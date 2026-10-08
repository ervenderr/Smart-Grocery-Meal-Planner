'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronRight, LogOut, X } from 'lucide-react';
import { NAV_MORE, type MoreNavItem } from '@/lib/navigation';
import { useLogout } from '@/lib/auth/use-logout';

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unread: number;
}

const ROW_CLASS =
  'flex min-h-12 w-full items-center gap-4 px-4 text-left text-base text-gray-900 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500';

function SheetGroup({
  title,
  items,
  unread,
  onNavigate,
}: {
  title: string;
  items: ReadonlyArray<MoreNavItem>;
  unread: number;
  onNavigate: () => void;
}) {
  return (
    <section aria-label={title}>
      <h3 className="px-4 pb-2 pt-4 text-sm font-semibold text-gray-500">{title}</h3>
      <ul>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} onClick={onNavigate} className={ROW_CLASS}>
                <Icon className="h-5 w-5 text-gray-600" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.href === '/alerts' && unread > 0 && (
                  <span className="rounded-full bg-red-500 px-2 text-sm font-semibold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MoreSheet({ open, onOpenChange, unread }: MoreSheetProps) {
  const pathname = usePathname();
  const logout = useLogout();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const close = () => onOpenChange(false);

  // Close whenever the route changes.
  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    close();
    await logout();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-900/50" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-safe animate-slide-up"
        >
          <div className="flex justify-center pt-2" aria-hidden="true">
            <div className="h-1 w-12 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between pl-4 pr-2">
            <Dialog.Title
              ref={titleRef}
              tabIndex={-1}
              className="text-xl font-semibold text-gray-900 focus:outline-none"
            >
              More
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <SheetGroup
            title="Explore"
            items={NAV_MORE.filter((item) => item.group === 'explore')}
            unread={unread}
            onNavigate={close}
          />
          <SheetGroup
            title="Account"
            items={NAV_MORE.filter((item) => item.group === 'account')}
            unread={unread}
            onNavigate={close}
          />

          <div className="mt-2 border-t border-gray-200">
            <button type="button" onClick={handleLogout} className={`${ROW_CLASS} text-red-600`}>
              <LogOut className="h-5 w-5" aria-hidden="true" />
              <span className="flex-1">Log Out</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
