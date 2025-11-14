'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Sparkles, Calendar, Banknote, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { aiApi, type MealPlanSuggestion } from '@/lib/api/ai';
import toast from 'react-hot-toast';

const aiMealPlanSchema = z.object({
  daysCount: z.number().min(1).max(14),
  budgetCents: z.number().min(100).max(10000000),
  dietaryRestrictions: z.array(z.string()).optional(),
  usePantry: z.boolean().optional(),
});

type AIFormData = z.infer<typeof aiMealPlanSchema>;

interface AIMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealPlanGenerated?: (suggestion: MealPlanSuggestion) => void;
}

const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'halal',
  'kosher',
];

export function AIMealPlanModal({
  isOpen,
  onClose,
  onMealPlanGenerated,
}: AIMealPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<MealPlanSuggestion | null>(null);
  const [pantryItemsUsed, setPantryItemsUsed] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<AIFormData>({
    resolver: zodResolver(aiMealPlanSchema),
    defaultValues: {
      daysCount: 7,
      budgetCents: 200000, // ₱2000
      dietaryRestrictions: [],
      usePantry: true,
    },
  });

  const budgetPesos = watch('budgetCents') / 100;

  const handleGenerate = async (data: AIFormData) => {
    setLoading(true);
    try {
      const result = await aiApi.generateMealPlan({
        daysCount: data.daysCount,
        budgetCents: data.budgetCents,
        dietaryRestrictions: data.dietaryRestrictions || [],
        usePantry: data.usePantry,
      });

      setSuggestion(result.mealPlan);
      setPantryItemsUsed(result.pantryItemsUsed);
      toast.success('AI meal plan generated!');
    } catch (error: any) {
      console.error('AI meal plan error:', error);
      toast.error(error.response?.data?.error || 'Failed to generate meal plan');
    } finally {
      setLoading(false);
    }
  };

  const handleUse = () => {
    if (suggestion) {
      onMealPlanGenerated?.(suggestion);
      onClose();
      reset();
      setSuggestion(null);
    }
  };

  const handleCancel = () => {
    onClose();
    reset();
    setSuggestion(null);
  };

  if (!isOpen) return null;

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/50" onClick={handleCancel}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Meal Plan Generator</h2>
              <p className="text-sm text-gray-600">Powered by Google Gemini AI</p>
            </div>
          </div>
          <button onClick={handleCancel} className="rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!suggestion ? (
            <form onSubmit={handleSubmit(handleGenerate)} className="space-y-6">
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  {...register('daysCount', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                {errors.daysCount && (
                  <p className="mt-1 text-sm text-red-600">{errors.daysCount.message}</p>
                )}
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget (₱{budgetPesos.toFixed(2)})
                </label>
                <input
                  type="range"
                  min="10000"
                  max="1000000"
                  step="10000"
                  {...register('budgetCents', { valueAsNumber: true })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>₱100</span>
                  <span>₱10,000</span>
                </div>
                {errors.budgetCents && (
                  <p className="mt-1 text-sm text-red-600">{errors.budgetCents.message}</p>
                )}
              </div>

              {/* Use Pantry Items */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="usePantry"
                  {...register('usePantry')}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="usePantry" className="text-sm font-medium text-gray-700">
                  Use ingredients from my pantry
                </label>
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Restrictions (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        value={option}
                        {...register('dietaryRestrictions')}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="capitalize">{option.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Generating your meal plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Meal Plan
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2">{suggestion.name}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span className="text-purple-800">{suggestion.meals.length} meals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-purple-600" />
                    <span className="text-purple-800">₱{(suggestion.estimatedCostCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-purple-600" />
                    <span className="text-purple-800">{suggestion.totalCalories.toLocaleString()} cal</span>
                  </div>
                </div>
                {pantryItemsUsed > 0 && (
                  <p className="text-sm text-purple-700 mt-2">
                    Uses {pantryItemsUsed} items from your pantry
                  </p>
                )}
              </div>

              {/* Meals by Day */}
              <div className="space-y-4">
                {dayNames.map((dayName, dayIndex) => {
                  const dayMeals = suggestion.meals.filter(m => m.day === dayIndex);
                  if (dayMeals.length === 0) return null;

                  return (
                    <div key={dayIndex} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">{dayName}</h4>
                      <div className="space-y-3">
                        {dayMeals.map((meal, mealIndex) => (
                          <div key={mealIndex} className="flex gap-3">
                            <span className="text-xs font-medium text-gray-500 uppercase w-20 flex-shrink-0 pt-1">
                              {meal.mealType}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{meal.recipeName}</p>
                              <p className="text-sm text-gray-600 mt-1">
                                {meal.ingredients.join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSuggestion(null)} className="flex-1">
                  Generate New Plan
                </Button>
                <Button onClick={handleUse} className="flex-1">
                  Use This Meal Plan
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
