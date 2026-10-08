'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Sparkles, Calendar, Banknote, Utensils, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { aiApi, type MealPlanSuggestion } from '@/lib/api/ai';
import { mealPlanApi } from '@/lib/api/mealplans';
import { getApiErrorMessage } from '@/lib/api/errors';
import { DIETARY_OPTIONS } from '@/lib/constants/dietary';
import { useCurrency } from '@/lib/currency/currency-provider';
import { centsToMajorString } from '@/lib/currency/format';
import { parseBudgetInput } from '@/lib/currency/budget';
import { DietFilterNotice } from './diet-filter-notice';
import toast from 'react-hot-toast';

const aiMealPlanSchema = z.object({
  daysCount: z.number().min(1).max(14),
  budgetCents: z
    .number()
    .int()
    .min(100, 'Enter a budget of 1 or more')
    .max(100_000_000, 'Enter a smaller weekly budget'),
  dietaryRestrictions: z.array(z.string()).optional(),
  usePantry: z.boolean().optional(),
});

type AIFormData = z.infer<typeof aiMealPlanSchema>;

interface AIMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealPlanSaved?: () => void;
}

const saveMealPlanSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  notes: z.string().optional(),
});

type SaveMealPlanFormData = z.infer<typeof saveMealPlanSchema>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function defaultSaveDates() {
  const now = Date.now();
  return {
    startDate: new Date(now).toISOString().split('T')[0],
    endDate: new Date(now + WEEK_MS).toISOString().split('T')[0],
  };
}

const DEFAULT_BUDGET_CENTS = 200000;

export function AIMealPlanModal({
  isOpen,
  onClose,
  onMealPlanSaved,
}: AIMealPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<MealPlanSuggestion | null>(null);
  const [pantryItemsUsed, setPantryItemsUsed] = useState(0);
  const [filteredOut, setFilteredOut] = useState(0);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const { format, currency } = useCurrency();
  const [budgetInput, setBudgetInput] = useState(centsToMajorString(DEFAULT_BUDGET_CENTS));
  const [budgetTextError, setBudgetTextError] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<AIFormData>({
    resolver: zodResolver(aiMealPlanSchema),
    defaultValues: {
      daysCount: 7,
      budgetCents: DEFAULT_BUDGET_CENTS,
      dietaryRestrictions: [],
      usePantry: true,
    },
  });

  const {
    register: registerSave,
    handleSubmit: handleSubmitSave,
    formState: { errors: saveErrors },
    reset: resetSave,
  } = useForm<SaveMealPlanFormData>({
    resolver: zodResolver(saveMealPlanSchema),
    defaultValues: defaultSaveDates(),
  });

  const handleBudgetChange = (value: string) => {
    setBudgetInput(value);
    const parsed = parseBudgetInput(value, currency);
    if (!parsed.ok) {
      // Zero fails the schema, so the previous valid amount can never be submitted
      setBudgetTextError(parsed.message);
      setValue('budgetCents', 0, { shouldDirty: true });
      return;
    }
    setBudgetTextError(undefined);
    setValue('budgetCents', parsed.cents, { shouldValidate: true, shouldDirty: true });
  };

  const handleGenerate = async (data: AIFormData) => {
    if (budgetTextError) return;
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
      setFilteredOut(result.filteredOut ?? 0);
      toast.success('AI meal plan generated!');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to generate meal plan'));
    } finally {
      setLoading(false);
    }
  };

  const handleUse = () => {
    setShowSaveForm(true);
  };

  const handleSave = async (data: SaveMealPlanFormData) => {
    if (!suggestion) return;

    setSaving(true);
    try {
      await mealPlanApi.createFromAI({
        aiSuggestion: suggestion,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes,
      });

      toast.success('Meal plan saved successfully!');
      onMealPlanSaved?.();
      handleCancel();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to save meal plan'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
    reset();
    resetSave();
    setSuggestion(null);
    setShowSaveForm(false);
    setBudgetInput(centsToMajorString(DEFAULT_BUDGET_CENTS));
    setBudgetTextError(undefined);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/50" onClick={handleCancel}></div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-meal-plan-title"
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 id="ai-meal-plan-title" className="text-xl font-bold text-gray-900">AI Meal Plan Generator</h2>
              <p className="text-sm text-gray-600">Intelligent meal planning for your week</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {!suggestion ? (
            <form onSubmit={handleSubmit(handleGenerate)} className="space-y-6">
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

              <Input
                label={`Weekly budget (${currency})`}
                type="text"
                inputMode="decimal"
                value={budgetInput}
                onChange={(e) => handleBudgetChange(e.target.value)}
                error={budgetTextError ?? errors.budgetCents?.message}
              />

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Restrictions (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        value={value}
                        {...register('dietaryRestrictions')}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>{label}</span>
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
          ) : showSaveForm ? (
            <form onSubmit={handleSubmitSave(handleSave)} className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-1">{suggestion.name}</h3>
                <p className="text-sm text-purple-700">
                  {suggestion.meals.length} meals • {format(suggestion.estimatedCostCents)}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Schedule Your Meal Plan
                </h3>

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <Input
                    label="Start Date"
                    type="date"
                    error={saveErrors.startDate?.message}
                    disabled={saving}
                    required
                    {...registerSave('startDate')}
                  />

                  <Input
                    label="End Date"
                    type="date"
                    error={saveErrors.endDate?.message}
                    disabled={saving}
                    required
                    {...registerSave('endDate')}
                  />
                </div>

                <div>
                  <textarea
                    placeholder="Add notes about this meal plan..."
                    rows={2}
                    disabled={saving}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    {...registerSave('notes')}
                  />
                  {saveErrors.notes && <p className="mt-1 text-sm text-red-500">{saveErrors.notes.message}</p>}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSaveForm(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Meal Plan
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2">{suggestion.name}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span className="text-purple-800">{suggestion.meals.length} meals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-purple-600" />
                    <span className="text-purple-800">{format(suggestion.estimatedCostCents)}</span>
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

              <DietFilterNotice filteredOut={filteredOut} />

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
