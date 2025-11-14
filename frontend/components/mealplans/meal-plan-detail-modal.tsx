'use client';

import { Calendar, Banknote, Flame, Heart, Clock, Users } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { MealPlan, MealPlanItem } from '@/types/mealplan.types';

interface MealPlanDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan: MealPlan | null;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function MealPlanDetailModal({ isOpen, onClose, mealPlan }: MealPlanDetailModalProps) {
  if (!mealPlan) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatCost = (cents: number | null) => {
    if (cents === null) return 'Not calculated';
    return `₱${(cents / 100).toFixed(2)}`;
  };

  const getMealsByDay = () => {
    const mealsByDay: Record<number, MealPlanItem[]> = {};
    mealPlan.meals.forEach(meal => {
      if (!mealsByDay[meal.dayOfWeek]) {
        mealsByDay[meal.dayOfWeek] = [];
      }
      mealsByDay[meal.dayOfWeek].push(meal);
    });
    return mealsByDay;
  };

  const getMealTypeColor = (mealType: string) => {
    const colors: Record<string, string> = {
      breakfast: 'bg-yellow-100 text-yellow-800',
      lunch: 'bg-green-100 text-green-800',
      dinner: 'bg-blue-100 text-blue-800',
      snack: 'bg-purple-100 text-purple-800',
    };
    return colors[mealType] || 'bg-gray-100 text-gray-800';
  };

  const mealsByDay = getMealsByDay();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mealPlan.name} size="xl">
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-5 w-5 text-primary-600" />
            <span className="text-sm">
              {formatDate(mealPlan.startDate)} - {formatDate(mealPlan.endDate)}
            </span>
          </div>
          {mealPlan.isFavorite && (
            <div className="flex items-center gap-1 text-red-600">
              <Heart className="h-4 w-4 fill-red-600" />
              <span className="text-sm font-medium">Favorite</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{mealPlan.meals.length}</p>
            <p className="text-xs text-gray-500">Total Meals</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
              <Banknote className="h-4 w-4" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{formatCost(mealPlan.totalCostCents)}</p>
            <p className="text-xs text-gray-500">Total Cost</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 text-orange-600 mb-1">
              <Flame className="h-4 w-4" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{mealPlan.totalCalories || '-'}</p>
            <p className="text-xs text-gray-500">Total Calories</p>
          </div>
        </div>

        {/* Notes */}
        {mealPlan.notes && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">{mealPlan.notes}</p>
          </div>
        )}

        {/* Meals by Day */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Weekly Schedule
          </h4>
          <div className="space-y-4">
            {daysOfWeek.map((dayName, dayIndex) => {
              const meals = mealsByDay[dayIndex] || [];
              return (
                <div key={dayIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2">
                    <h5 className="font-semibold text-gray-900">{dayName}</h5>
                  </div>
                  {meals.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No meals planned</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {meals.map((meal) => (
                        <div key={meal.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getMealTypeColor(meal.mealType)}`}>
                                  {meal.mealType}
                                </span>
                                {meal.recipe && (
                                  <span className="text-sm font-medium text-gray-900">
                                    {meal.recipe.name}
                                  </span>
                                )}
                              </div>
                              {meal.recipe && (
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{meal.recipe.prepTimeMinutes + meal.recipe.cookTimeMinutes} min</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    <span>{meal.servings} servings</span>
                                  </div>
                                  {meal.calories && (
                                    <div className="flex items-center gap-1">
                                      <Flame className="h-3 w-3" />
                                      <span>{meal.calories} cal</span>
                                    </div>
                                  )}
                                  {meal.costCents && (
                                    <div className="flex items-center gap-1">
                                      <Banknote className="h-3 w-3" />
                                      <span>₱{(meal.costCents / 100).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
