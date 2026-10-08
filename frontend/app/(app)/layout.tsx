'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { OnboardingGate } from '@/components/onboarding/onboarding-gate';
import { IosInstallHint } from '@/components/pwa/ios-install-hint';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-base focus:font-semibold focus:text-primary-700 focus:shadow-soft"
      >
        Skip to content
      </a>
      <div className="flex h-dvh bg-gray-50">
        <DashboardSidebar />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardHeader />

          {/* Page Content */}
          <main
            id="main"
            className="flex-1 overflow-y-auto overscroll-contain bg-gray-50 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:p-8"
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
      <OnboardingGate />
      <IosInstallHint />
    </ProtectedRoute>
  );
}
