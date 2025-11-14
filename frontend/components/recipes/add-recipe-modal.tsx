'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { recipeApi } from '@/lib/api/recipes';
import toast from 'react-hot-toast';
import type { RecipeCategory, RecipeDifficulty, RecipeIngredientUnit, DietaryRestriction } from '@/types/recipe.types';

const recipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(200, 'Name too long'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  difficulty: z.string().min(1, 'Difficulty is required'),
  prepTimeMinutes: z.number().min(0, 'Prep time must be 0 or greater'),
  cookTimeMinutes: z.number().min(0, 'Cook time must be 0 or greater'),
  servings: z.number().min(1, 'Servings must be at least 1'),
  ingredients: z.array(z.object({
    ingredientName: z.string().min(1, 'Ingredient name required'),
    quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
    unit: z.string().min(1, 'Unit is required'),
    notes: z.string().optional(),
  })).min(1, 'At least one ingredient required'),
  instructions: z.array(z.string().min(1, 'Step cannot be empty')).min(1, 'At least one instruction required'),
  imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  tags: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const categories: { value: RecipeCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'beverage', label: 'Beverage' },
];

const difficulties: { value: RecipeDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const units: { value: RecipeIngredientUnit; label: string }[] = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'liters', label: 'Liters (L)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'cups', label: 'Cups' },
  { value: 'tbsp', label: 'Tablespoons' },
  { value: 'tsp', label: 'Teaspoons' },
  { value: 'fl_oz', label: 'Fluid Ounces' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'items', label: 'Items' },
];

const dietaryRestrictions: { value: DietaryRestriction; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten Free' },
  { value: 'dairy_free', label: 'Dairy Free' },
  { value: 'nut_free', label: 'Nut Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
];

export function AddRecipeModal({ isOpen, onClose, onSuccess }: AddRecipeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      ingredients: [{ ingredientName: '', quantity: 0, unit: '', notes: '' }],
      instructions: [''],
      isPublic: false,
    },
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control,
    name: 'ingredients',
  });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } = useFieldArray({
    control,
    name: 'instructions' as any,
  });

  const onSubmit = async (data: RecipeFormData) => {
    setIsLoading(true);

    try {
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      await recipeApi.create({
        name: data.name,
        description: data.description || undefined,
        category: data.category as RecipeCategory,
        difficulty: data.difficulty as RecipeDifficulty,
        prepTimeMinutes: data.prepTimeMinutes,
        cookTimeMinutes: data.cookTimeMinutes,
        servings: data.servings,
        ingredients: data.ingredients.map(ing => ({
          ingredientName: ing.ingredientName,
          quantity: ing.quantity,
          unit: ing.unit as RecipeIngredientUnit,
          notes: ing.notes || undefined,
        })),
        instructions: data.instructions.filter(Boolean),
        imageUrl: data.imageUrl || undefined,
        tags,
        dietaryRestrictions: selectedRestrictions as DietaryRestriction[],
        isPublic: data.isPublic,
      });

      toast.success('Recipe created successfully!');
      reset();
      setSelectedRestrictions([]);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Create recipe error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to create recipe. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      reset();
      setSelectedRestrictions([]);
      onClose();
    }
  };

  const toggleRestriction = (value: string) => {
    setSelectedRestrictions(prev =>
      prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Recipe" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Basic Information
          </h3>

          <Input
            label="Recipe Name"
            placeholder="e.g., Spaghetti Carbonara"
            error={errors.name?.message}
            disabled={isLoading}
            required
            {...register('name')}
          />

          <div>
            <textarea
              placeholder="Describe your recipe..."
              rows={2}
              disabled={isLoading}
              className="flex w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              {...register('description')}
            />
            {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>}
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Select
              label="Category"
              error={errors.category?.message}
              disabled={isLoading}
              required
              {...register('category')}
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>

            <Select
              label="Difficulty"
              error={errors.difficulty?.message}
              disabled={isLoading}
              required
              {...register('difficulty')}
            >
              <option value="">Select difficulty</option>
              {difficulties.map((diff) => (
                <option key={diff.value} value={diff.value}>
                  {diff.label}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Image URL (Optional)"
            placeholder="https://example.com/image.jpg"
            error={errors.imageUrl?.message}
            disabled={isLoading}
            {...register('imageUrl')}
          />
        </div>

        {/* Time & Servings */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Time & Servings
          </h3>

          <div className="grid gap-4 grid-cols-3">
            <Input
              label="Prep Time (min)"
              type="number"
              min="0"
              placeholder="10"
              error={errors.prepTimeMinutes?.message}
              disabled={isLoading}
              required
              {...register('prepTimeMinutes', { valueAsNumber: true })}
            />

            <Input
              label="Cook Time (min)"
              type="number"
              min="0"
              placeholder="20"
              error={errors.cookTimeMinutes?.message}
              disabled={isLoading}
              required
              {...register('cookTimeMinutes', { valueAsNumber: true })}
            />

            <Input
              label="Servings"
              type="number"
              min="1"
              placeholder="4"
              error={errors.servings?.message}
              disabled={isLoading}
              required
              {...register('servings', { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Ingredients */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Ingredients
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendIngredient({ ingredientName: '', quantity: 0, unit: '', notes: '' })}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {ingredientFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-2 grid-cols-2 sm:grid-cols-4">
                  <input
                    placeholder="Ingredient"
                    disabled={isLoading}
                    className="col-span-2 sm:col-span-1 h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                    {...register(`ingredients.${index}.ingredientName`)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    disabled={isLoading}
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                    {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })}
                  />
                  <select
                    disabled={isLoading}
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                    {...register(`ingredients.${index}.unit`)}
                  >
                    <option value="">Unit</option>
                    {units.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Notes (optional)"
                    disabled={isLoading}
                    className="col-span-2 sm:col-span-1 h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                    {...register(`ingredients.${index}.notes`)}
                  />
                </div>
                {ingredientFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    disabled={isLoading}
                    className="h-11 px-3 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.ingredients && <p className="text-sm text-red-500">{errors.ingredients.message}</p>}
        </div>

        {/* Instructions */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Instructions
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (appendInstruction as any)('')}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>

          <div className="space-y-2">
            {instructionFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <span className="text-sm font-medium text-gray-500 mt-3">{index + 1}.</span>
                <textarea
                  placeholder={`Step ${index + 1}`}
                  rows={2}
                  disabled={isLoading}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 resize-none"
                  {...register(`instructions.${index}`)}
                />
                {instructionFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInstruction(index)}
                    disabled={isLoading}
                    className="mt-2 px-3 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.instructions && <p className="text-sm text-red-500">{errors.instructions.message}</p>}
        </div>

        {/* Tags & Dietary Restrictions */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Additional Info (Optional)
          </h3>

          <Input
            label="Tags"
            placeholder="italian, pasta, quick (comma-separated)"
            error={errors.tags?.message}
            disabled={isLoading}
            {...register('tags')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Dietary Restrictions
            </label>
            <div className="flex flex-wrap gap-2">
              {dietaryRestrictions.map((restriction) => (
                <button
                  key={restriction.value}
                  type="button"
                  onClick={() => toggleRestriction(restriction.value)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                    selectedRestrictions.includes(restriction.value)
                      ? 'bg-primary-100 border-primary-500 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {restriction.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              disabled={isLoading}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('isPublic')}
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700">
              Make this recipe public (visible to other users)
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 pb-safe border-t border-gray-200">
          <Button type="button" variant="outline" fullWidth onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" fullWidth loading={isLoading} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Recipe'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
