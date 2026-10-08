'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { NAV_SIDEBAR, isActive } from '@/lib/navigation';

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar (desktop only; phones use the bottom nav) */}
      <aside className="hidden border-r border-gray-200 bg-white lg:flex lg:w-64 lg:flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/kitcha-logo-name.svg"
              alt="Kitcha"
              width={120}
              height={32}
              priority
              className="h-20 w-auto"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Primary" className="flex-1 space-y-1 p-4">
          {NAV_SIDEBAR.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 p-4">
          <div className="rounded-lg bg-primary-50 p-3">
            <p className="text-xs font-semibold text-primary-900">Need Help?</p>
            <p className="mt-1 text-xs text-primary-700">
              Check out our documentation or contact support
            </p>
            <Link
              href="/help"
              className="mt-2 block text-xs font-medium text-primary-600 hover:text-primary-800"
            >
              Learn More →
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
