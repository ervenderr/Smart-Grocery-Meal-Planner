'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, LogOut, User, Settings } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLogout } from '@/lib/auth/use-logout';
import { getPageTitle } from '@/lib/navigation';
import { NotificationsDropdown } from './notifications-dropdown';

export function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const user = useAuthStore((state) => state.user);
  const handleLogout = useLogout();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white pt-safe lg:shadow-sm">
     <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:h-16 lg:px-8">
      {/* Left Side */}
      <div className="flex min-w-0 items-center gap-2 lg:gap-4">
        {/* Compact brand + page title (below lg) */}
        <Link href="/dashboard" className="flex shrink-0 items-center lg:hidden" aria-label="Kitcha home">
          <Image src="/kitcha-logo.svg" alt="" width={32} height={32} className="h-8 w-8" />
        </Link>
        <span className="truncate text-xl font-semibold text-gray-900 lg:hidden" aria-hidden="true">
          {getPageTitle(pathname)}
        </span>

        {/* Search Bar */}
        <div className="hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              aria-label="Search"
              className="h-10 w-64 rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <NotificationsDropdown />

        {/* User Menu */}
        <div className="relative hidden lg:block">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-white text-sm font-semibold">
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.firstName || 'User'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.email || ''}
              </p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              ></div>

              {/* Menu */}
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                <div className="border-b border-gray-200 p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>

                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/profile');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/settings');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-gray-200 p-2">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
     </div>
    </header>
  );
}
