'use client';

import { Clock, Users, ChefHat, Calendar } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { Recipe } from '@/types/recipe.types';

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
}

export function RecipeDetailModal({ isOpen, onClose, recipe }: RecipeDetailModalProps) {
  if (!recipe) return null;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      breakfast: 'bg-yellow-100 text-yellow-800',
      lunch: 'bg-green-100 text-green-800',
      dinner: 'bg-blue-100 text-blue-800',
      snack: 'bg-orange-100 text-orange-800',
      dessert: 'bg-pink-100 text-pink-800',
      beverage: 'bg-purple-100 text-purple-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-amber-100 text-amber-700',
      hard: 'bg-red-100 text-red-700',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-700';
  };

  const formatRestriction = (restriction: string) => {
    return restriction.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={recipe.name} size="xl">
      <div className="space-y-6">
        {/* Image */}
        {recipe.imageUrl ? (
          <div className="w-full h-48 sm:h-64 rounded-lg overflow-hidden bg-gray-200">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-48 sm:h-64 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <ChefHat className="h-20 w-20 text-primary-400" />
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${getCategoryColor(recipe.category)}`}>
            {recipe.category}
          </span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${getDifficultyColor(recipe.difficulty)}`}>
            {recipe.difficulty}
          </span>
          {recipe.isPublic && (
            <span className="rounded-full px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700">
              Public
            </span>
          )}
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-gray-700 leading-relaxed">{recipe.description}</p>
        )}

        {/* Meta Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">Prep Time</p>
              <p className="font-medium">{recipe.prepTimeMinutes} min</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">Cook Time</p>
              <p className="font-medium">{recipe.cookTimeMinutes} min</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">Total Time</p>
              <p className="font-medium">{recipe.totalTimeMinutes} min</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">Servings</p>
              <p className="font-medium">{recipe.servings}</p>
            </div>
          </div>
        </div>

        {/* Dietary Restrictions */}
        {recipe.dietaryRestrictions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Dietary Information</h4>
            <div className="flex flex-wrap gap-2">
              {recipe.dietaryRestrictions.map((restriction, index) => (
                <span key={index} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                  {formatRestriction(restriction)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((tag, index) => (
                <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Ingredients
          </h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-primary-600 mt-1">•</span>
                <div className="flex-1">
                  <span className="font-medium text-gray-900">
                    {ingredient.quantity} {ingredient.unit}
                  </span>
                  <span className="text-gray-700"> {ingredient.ingredientName}</span>
                  {ingredient.notes && (
                    <span className="text-gray-500 text-sm"> ({ingredient.notes})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Instructions
          </h4>
          <div className="space-y-4">
            {recipe.instructions.map((instruction, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold text-sm">
                  {index + 1}
                </div>
                <p className="flex-1 text-gray-700 leading-relaxed pt-1">{instruction}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Created Date */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>Created {new Date(recipe.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
