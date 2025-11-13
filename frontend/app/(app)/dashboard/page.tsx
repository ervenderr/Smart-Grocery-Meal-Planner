'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Card } from '@/components/ui/card';
import { ShoppingCart, Package, Calendar, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const stats = [
    {
      name: 'Pantry Items',
      value: '24',
      icon: Package,
      change: '+2 this week',
      changeType: 'positive',
      color: 'bg-blue-500',
    },
    {
      name: 'Meal Plans',
      value: '3',
      icon: Calendar,
      change: '1 active',
      changeType: 'neutral',
      color: 'bg-green-500',
    },
    {
      name: 'Shopping Lists',
      value: '2',
      icon: ShoppingCart,
      change: '1 pending',
      changeType: 'neutral',
      color: 'bg-purple-500',
    },
    {
      name: 'Budget Status',
      value: '82%',
      icon: TrendingUp,
      change: 'On track',
      changeType: 'positive',
      color: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your grocery and meal planning today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{stat.change}</p>
                </div>
                <div className={`rounded-lg ${stat.color} p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <Package className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Add Pantry Item</p>
                <p className="text-xs text-gray-500">Track what you have at home</p>
              </div>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Create Meal Plan</p>
                <p className="text-xs text-gray-500">Plan your weekly meals</p>
              </div>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">New Shopping List</p>
                <p className="text-xs text-gray-500">Start a new grocery list</p>
              </div>
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Added 3 items to pantry</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <Calendar className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Created meal plan for next week</p>
                <p className="text-xs text-gray-500">Yesterday</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <ShoppingCart className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Completed shopping list</p>
                <p className="text-xs text-gray-500">2 days ago</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
