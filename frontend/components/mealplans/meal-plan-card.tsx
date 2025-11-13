'use client';

import { Edit2, Trash2, Calendar, DollarSign, Flame, Heart, ShoppingCart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { MealPlan } from '@/types/mealplan.types';

interface MealPlanCardProps {
  mealPlan: MealPlan;
  onEdit: (mealPlan: MealPlan) => void;
  onDelete: (mealPlan: MealPlan) => void;
  onView: (mealPlan: MealPlan) => void;
  onGenerateShoppingList: (mealPlan: MealPlan) => void;
}

export function MealPlanCard({ mealPlan, onEdit, onDelete, onView, onGenerateShoppingList }: MealPlanCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCost = (cents: number | null) => {
    if (cents === null) return '-';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getDaysDuration = () => {
    const start = new Date(mealPlan.startDate);
    const end = new Date(mealPlan.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(mealPlan)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{mealPlan.name}</h3>
            {mealPlan.isFavorite && (
              <Heart className="h-4 w-4 text-red-500 fill-red-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {formatDate(mealPlan.startDate)} - {formatDate(mealPlan.endDate)} ({getDaysDuration()} days)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-medium text-gray-900">{mealPlan.meals.length}</p>
          <p className="text-xs text-gray-500">Meals</p>
        </div>
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <DollarSign className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-medium text-gray-900">{formatCost(mealPlan.totalCostCents)}</p>
          <p className="text-xs text-gray-500">Cost</p>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
            <Flame className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-medium text-gray-900">{mealPlan.totalCalories || '-'}</p>
          <p className="text-xs text-gray-500">Calories</p>
        </div>
      </div>

      {/* Notes */}
      {mealPlan.notes && (
        <p className="text-xs text-gray-600 line-clamp-2 mb-3">{mealPlan.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGenerateShoppingList(mealPlan);
          }}
          className="flex-1 rounded-lg px-2 py-2 text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors flex items-center justify-center gap-1"
          title="Generate shopping list"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          List
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(mealPlan);
          }}
          className="flex-1 rounded-lg px-2 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(mealPlan);
          }}
          className="flex-1 rounded-lg px-2 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </Card>
  );
}
