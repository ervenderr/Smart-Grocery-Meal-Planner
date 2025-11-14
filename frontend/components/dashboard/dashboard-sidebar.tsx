'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X, ShoppingCart, Home, Package, UtensilsCrossed, Calendar, ShoppingBasket, TrendingUp, Bell, BarChart3, Settings } from 'lucide-react';

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Pantry', href: '/pantry', icon: Package },
  { name: 'Recipes', href: '/recipes', icon: UtensilsCrossed },
  { name: 'Meal Plans', href: '/mealplans', icon: Calendar },
  { name: 'Shopping Lists', href: '/shopping', icon: ShoppingBasket },
  { name: 'Budget', href: '/budget', icon: TrendingUp },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-900/50 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo & Close Button */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary-500" />
            <span className="text-lg font-bold text-gray-900">KITCHA</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
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
