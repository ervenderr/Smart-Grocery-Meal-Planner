'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { mealPlanApi } from '@/lib/api/mealplans';
import { recipeApi } from '@/lib/api/recipes';
import toast from 'react-hot-toast';
import type { MealType, DayOfWeek } from '@/types/mealplan.types';
import type { Recipe } from '@/types/recipe.types';

const mealPlanSchema = z.object({
  name: z.string().min(1, 'Meal plan name is required').max(200, 'Name too long'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  notes: z.string().max(1000, 'Notes too long').optional(),
  meals: z.array(z.object({
    recipeId: z.string().min(1, 'Recipe is required'),
    dayOfWeek: z.number().min(0).max(6),
    mealType: z.string().min(1, 'Meal type is required'),
    servings: z.number().min(1, 'Servings must be at least 1'),
  })).min(1, 'At least one meal required'),
});

type MealPlanFormData = z.infer<typeof mealPlanSchema>;

interface AddMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const daysOfWeek = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const mealTypes: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function AddMealPlanModal({ isOpen, onClose, onSuccess }: AddMealPlanModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm<MealPlanFormData>({
    resolver: zodResolver(mealPlanSchema),
    defaultValues: {
      meals: [{ recipeId: '', dayOfWeek: 0, mealType: 'breakfast', servings: 1 }],
    },
  });

  const { fields: mealFields, append: appendMeal, remove: removeMeal } = useFieldArray({
    control,
    name: 'meals',
  });

  useEffect(() => {
    if (isOpen) {
      fetchRecipes();
    }
  }, [isOpen]);

  const fetchRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const response = await recipeApi.getAll({ limit: 100 });
      setRecipes(response.items || []);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const onSubmit = async (data: MealPlanFormData) => {
    setIsLoading(true);

    try {
      await mealPlanApi.create({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes || undefined,
        meals: data.meals.map(meal => ({
          recipeId: meal.recipeId,
          dayOfWeek: meal.dayOfWeek as DayOfWeek,
          mealType: meal.mealType as MealType,
          servings: meal.servings,
        })),
      });

      toast.success('Meal plan created successfully!');
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Create meal plan error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to create meal plan. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      reset();
      onClose();
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Meal Plan" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Basic Information
          </h3>

          <Input
            label="Plan Name"
            placeholder="e.g., Week 1 Meal Plan"
            error={errors.name?.message}
            disabled={isLoading}
            required
            {...register('name')}
          />

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Input
              label="Start Date"
              type="date"
              min={getTodayDate()}
              error={errors.startDate?.message}
              disabled={isLoading}
              required
              {...register('startDate')}
            />

            <Input
              label="End Date"
              type="date"
              min={getTodayDate()}
              error={errors.endDate?.message}
              disabled={isLoading}
              required
              {...register('endDate')}
            />
          </div>

          <div>
            <textarea
              placeholder="Add notes about this meal plan..."
              rows={2}
              disabled={isLoading}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              {...register('notes')}
            />
            {errors.notes && <p className="mt-1 text-sm text-red-500">{errors.notes.message}</p>}
          </div>
        </div>

        {/* Meals */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Meals
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendMeal({ recipeId: '', dayOfWeek: 0, mealType: 'breakfast', servings: 1 })}
              disabled={isLoading || loadingRecipes}
            >
              <Plus className="h-4 w-4" />
              Add Meal
            </Button>
          </div>

          <div className="space-y-3">
            {mealFields.map((field, index) => (
              <div key={field.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
                    <Select
                      label="Day"
                      error={errors.meals?.[index]?.dayOfWeek?.message}
                      disabled={isLoading}
                      required
                      {...register(`meals.${index}.dayOfWeek`, { valueAsNumber: true })}
                    >
                      {daysOfWeek.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Meal Type"
                      error={errors.meals?.[index]?.mealType?.message}
                      disabled={isLoading}
                      required
                      {...register(`meals.${index}.mealType`)}
                    >
                      {mealTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Recipe"
                      error={errors.meals?.[index]?.recipeId?.message}
                      disabled={isLoading || loadingRecipes}
                      required
                      {...register(`meals.${index}.recipeId`)}
                    >
                      <option value="">Select recipe</option>
                      {recipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Servings"
                      type="number"
                      min="1"
                      placeholder="1"
                      error={errors.meals?.[index]?.servings?.message}
                      disabled={isLoading}
                      required
                      {...register(`meals.${index}.servings`, { valueAsNumber: true })}
                    />
                  </div>

                  {mealFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMeal(index)}
                      disabled={isLoading}
                      className="mt-6 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {errors.meals && typeof errors.meals.message === 'string' && (
            <p className="text-sm text-red-500">{errors.meals.message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 pb-safe border-t border-gray-200">
          <Button type="button" variant="outline" fullWidth onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" fullWidth loading={isLoading} disabled={isLoading || loadingRecipes}>
            {isLoading ? 'Creating...' : 'Create Meal Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
