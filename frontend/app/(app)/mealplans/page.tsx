'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, ShoppingCart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { AddMealPlanModal } from '@/components/mealplans/add-meal-plan-modal';
import { MealPlanDetailModal } from '@/components/mealplans/meal-plan-detail-modal';
import { MealPlanCard } from '@/components/mealplans/meal-plan-card';
import { AIMealPlanModal } from '@/components/ai/ai-meal-plan-modal';
import { mealPlanApi } from '@/lib/api/mealplans';
import toast from 'react-hot-toast';
import type { MealPlan } from '@/types/mealplan.types';
import type { MealPlanSuggestion } from '@/lib/api/ai';

export default function MealPlansPage() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIMealPlanModal, setShowAIMealPlanModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MealPlan | null>(null);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [shoppingListData, setShoppingListData] = useState<any>(null);

  const fetchMealPlans = async () => {
    setLoading(true);
    try {
      const response = await mealPlanApi.getAll({
        sortBy: 'startDate',
        sortOrder: 'desc',
      });
      setMealPlans(response.items || []);
    } catch (error: any) {
      console.error('Fetch meal plans error:', error);
      toast.error('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const handleView = (mealPlan: MealPlan) => {
    setSelectedMealPlan(mealPlan);
    setShowDetailModal(true);
  };

  const handleEdit = (mealPlan: MealPlan) => {
    toast('Edit functionality coming soon! Delete and recreate for now.');
  };

  const handleDelete = async (mealPlan: MealPlan) => {
    if (deleteConfirm?.id === mealPlan.id) {
      try {
        await mealPlanApi.delete(mealPlan.id);
        toast.success('Meal plan deleted successfully');
        fetchMealPlans();
        setDeleteConfirm(null);
      } catch (error: any) {
        console.error('Delete error:', error);
        toast.error('Failed to delete meal plan');
      }
    } else {
      setDeleteConfirm(mealPlan);
      setTimeout(() => setDeleteConfirm(null), 3000);
      toast('Click delete again to confirm', { icon: '⚠️' });
    }
  };

  const handleGenerateShoppingList = async (mealPlan: MealPlan) => {
    try {
      const data = await mealPlanApi.getShoppingList(mealPlan.id);
      setShoppingListData(data);
      setShowShoppingList(true);
      toast.success('Shopping list generated!');
    } catch (error: any) {
      console.error('Generate shopping list error:', error);
      toast.error('Failed to generate shopping list');
    }
  };

  const handleAIMealPlanGenerated = (suggestion: MealPlanSuggestion) => {
    toast.success('AI meal plan ready! Opening form to save...');
    // For now, just show success and let user manually create
    // In the future, could auto-populate the Add Meal Plan form
    setShowAIMealPlanModal(false);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Meal Plans</h1>
          <p className="mt-1 text-sm text-gray-600">
            Plan your meals and generate shopping lists
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAIMealPlanModal(true)}>
            <Sparkles className="h-4 w-4" />
            AI Generate
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            Create Meal Plan
          </Button>
        </div>
      </div>

      {/* Shopping List Modal */}
      {showShoppingList && shoppingListData && (
        <Card className="p-6 border-primary-200 bg-primary-50">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary-100 p-2">
                <ShoppingCart className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-900">Shopping List Generated</h3>
                <p className="text-sm text-primary-700">
                  {shoppingListData.items.length} items
                  {shoppingListData.totalEstimatedCostCents &&
                    ` • Estimated: ₱${(shoppingListData.totalEstimatedCostCents / 100).toFixed(2)}`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowShoppingList(false)}
              className="text-primary-600 hover:text-primary-700"
            >
              Close
            </button>
          </div>
          <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {shoppingListData.items.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary-600 mt-0.5">•</span>
                  <div className="flex-1">
                    <span className="font-medium">{item.quantity} {item.unit}</span>
                    <span className="text-gray-700"> {item.ingredientName}</span>
                    {item.recipes && item.recipes.length > 0 && (
                      <span className="text-gray-500 text-xs"> (from {item.recipes.join(', ')})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Meal Plans Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : mealPlans.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <Calendar className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No meal plans yet</h3>
          <p className="mt-2 text-sm text-gray-600">
            Get started by creating your first meal plan
          </p>
          <Button onClick={() => setShowAddModal(true)} className="mt-4">
            <Plus className="h-4 w-4" />
            Create Your First Meal Plan
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {mealPlans.map((mealPlan) => (
            <MealPlanCard
              key={mealPlan.id}
              mealPlan={mealPlan}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerateShoppingList={handleGenerateShoppingList}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddMealPlanModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchMealPlans}
      />

      <MealPlanDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedMealPlan(null);
        }}
        mealPlan={selectedMealPlan}
      />

      <AIMealPlanModal
        isOpen={showAIMealPlanModal}
        onClose={() => setShowAIMealPlanModal(false)}
        onMealPlanGenerated={handleAIMealPlanGenerated}
      />
    </div>
  );
}
