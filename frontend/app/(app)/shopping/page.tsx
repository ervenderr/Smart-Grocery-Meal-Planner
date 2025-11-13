'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBasket, Calendar, AlertCircle, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { mealPlanApi } from '@/lib/api/mealplans';
import toast from 'react-hot-toast';
import type { MealPlan } from '@/types/mealplan.types';

export default function ShoppingPage() {
  const router = useRouter();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMealPlans = async () => {
    setLoading(true);
    try {
      const response = await mealPlanApi.getAll({
        sortBy: 'startDate',
        sortOrder: 'desc',
        limit: 10,
      });
      setMealPlans(response.items || []);
    } catch (error) {
      console.error('Failed to fetch meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const handleGenerateShoppingList = async (mealPlan: MealPlan) => {
    try {
      const shoppingList = await mealPlanApi.getShoppingList(mealPlan.id);

      if (!shoppingList.items || shoppingList.items.length === 0) {
        toast.error('No ingredients found in this meal plan');
        return;
      }

      // Store in session for display
      sessionStorage.setItem('current-shopping-list', JSON.stringify({
        mealPlanName: mealPlan.name,
        ...shoppingList,
      }));

      toast.success('Shopping list generated!');
      window.location.reload(); // Refresh to show the list
    } catch (error: any) {
      console.error('Generate shopping list error:', error);
      toast.error('Failed to generate shopping list');
    }
  };

  // Check if there's a shopping list in session
  const [currentList, setCurrentList] = useState<any>(null);

  useEffect(() => {
    const storedList = sessionStorage.getItem('current-shopping-list');
    if (storedList) {
      setCurrentList(JSON.parse(storedList));
    }
  }, []);

  const handleClearList = () => {
    sessionStorage.removeItem('current-shopping-list');
    setCurrentList(null);
    toast.success('Shopping list cleared');
  };

  const formatCost = (cents: number | null) => {
    if (cents === null) return 'N/A';
    return `₱${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Shopping Lists</h1>
          <p className="mt-1 text-sm text-gray-600">
            Generate shopping lists from your meal plans
          </p>
        </div>
        <Button onClick={() => router.push('/mealplans')}>
          <Plus className="h-4 w-4" />
          Create Meal Plan
        </Button>
      </div>

      {/* Current Shopping List */}
      {currentList && (
        <Card className="p-6 border-primary-200 bg-primary-50">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary-100 p-2">
                <ShoppingBasket className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-900">Current Shopping List</h3>
                <p className="text-sm text-primary-700">From: {currentList.mealPlanName}</p>
              </div>
            </div>
            <button
              onClick={handleClearList}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Clear
            </button>
          </div>

          <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {currentList.items.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-gray-900">
                        {item.quantity} {item.unit}
                      </span>
                      <span className="text-gray-700">{item.ingredientName}</span>
                    </div>
                    {item.recipes && item.recipes.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Used in: {item.recipes.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {currentList.totalEstimatedCostCents && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Estimated Total:</span>
                  <span className="text-lg font-bold text-primary-600">
                    {formatCost(currentList.totalEstimatedCostCents)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Generate from Meal Plans */}
      {mealPlans.length > 0 ? (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Generate Shopping List from Meal Plan
          </h3>
          <div className="space-y-3">
            {mealPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(plan.startDate).toLocaleDateString()} - {new Date(plan.endDate).toLocaleDateString()}
                      {' • '}{plan.meals.length} meals
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleGenerateShoppingList(plan)}
                >
                  Generate List
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <AlertCircle className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No Meal Plans Yet</h3>
          <p className="mt-2 text-sm text-gray-600 max-w-sm">
            Create a meal plan first to generate shopping lists automatically
          </p>
          <Button onClick={() => router.push('/mealplans')} className="mt-4">
            <Plus className="h-4 w-4" />
            Create Your First Meal Plan
          </Button>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">How Shopping Lists Work</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Create a meal plan with recipes</li>
              <li>• Generate a shopping list from the meal plan</li>
              <li>• All ingredients are automatically aggregated</li>
              <li>• Check off items as you shop</li>
              <li>• View estimated total cost</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
