'use client';

import { Edit2, Trash2, Clock, Users, ChefHat } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Recipe } from '@/types/recipe.types';

interface RecipeCardProps {
  recipe: Recipe;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onView: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, onEdit, onDelete, onView }: RecipeCardProps) {
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

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(recipe)}>
      {/* Image */}
      {recipe.imageUrl ? (
        <div className="h-40 w-full bg-gray-200">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
          <ChefHat className="h-16 w-16 text-primary-400" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 sm:p-4">
        {/* Title & Category */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{recipe.name}</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(recipe.category)}`}>
            {recipe.category}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(recipe.difficulty)}`}>
            {recipe.difficulty}
          </span>
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{recipe.description}</p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{recipe.totalTimeMinutes} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{recipe.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(recipe);
            }}
            className="flex-1 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Edit2 className="h-4 w-4 inline mr-1" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(recipe);
            }}
            className="flex-1 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4 inline mr-1" />
            Delete
          </button>
        </div>
      </div>
    </Card>
  );
}
