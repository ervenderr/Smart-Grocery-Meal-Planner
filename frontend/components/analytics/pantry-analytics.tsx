'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Package, AlertTriangle, TrendingUp, Archive } from 'lucide-react';
import { pantryApi } from '@/lib/api/pantry';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export function PantryAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    expiringSoon: 0,
    topCategory: 'N/A',
    avgShelfLife: 0,
  });
  const [topItems, setTopItems] = useState<any[]>([]);

  useEffect(() => {
    fetchPantryAnalytics();
  }, []);

  const fetchPantryAnalytics = async () => {
    setLoading(true);
    try {
      const [pantryResponse, expiringItems] = await Promise.all([
        pantryApi.getAll(),
        pantryApi.getExpiringSoon(7),
      ]);

      const items = pantryResponse.items;

      // Calculate category counts
      const categoryCounts: Record<string, number> = {};
      items.forEach((item: any) => {
        const category = item.category || 'uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      // Get top 5 items by quantity
      const sorted = [...items]
        .sort((a: any, b: any) => b.quantity - a.quantity)
        .slice(0, 5);

      setStats({
        totalItems: items.length,
        expiringSoon: expiringItems.length,
        topCategory: topCategory.charAt(0).toUpperCase() + topCategory.slice(1),
        avgShelfLife: 0, // Could calculate based on expiry dates
      });

      setTopItems(sorted);
    } catch (error) {
      console.error('Fetch pantry analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pantry Insights</h3>
          <p className="text-sm text-gray-600 mt-1">Overview of your pantry inventory</p>
        </div>
        <div className="rounded-full bg-orange-100 p-2">
          <Package className="h-5 w-5 text-orange-600" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Archive className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Total Items</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.totalItems}</p>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-medium text-red-900">Expiring Soon</p>
          </div>
          <p className="text-2xl font-bold text-red-900">{stats.expiringSoon}</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <p className="text-sm font-medium text-purple-900">Top Category</p>
          </div>
          <p className="text-xl font-bold text-purple-900">{stats.topCategory}</p>
        </div>
      </div>

      {/* Top Items */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Items by Quantity</h4>
        <div className="space-y-2">
          {topItems.length > 0 ? (
            topItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-5">#{index + 1}</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="text-xs text-gray-500 capitalize bg-gray-200 px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No items in pantry</p>
          )}
        </div>
      </div>
    </Card>
  );
}
