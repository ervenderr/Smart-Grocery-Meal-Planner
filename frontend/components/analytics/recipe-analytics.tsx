'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { UtensilsCrossed, Star, Clock, ChefHat } from 'lucide-react';
import { recipeApi } from '@/lib/api/recipes';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export function RecipeAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRecipes: 0,
    avgPrepTime: 0,
    mostCommonDifficulty: 'N/A',
    avgServings: 0,
  });
  const [topRecipes, setTopRecipes] = useState<any[]>([]);

  useEffect(() => {
    fetchRecipeAnalytics();
  }, []);

  const fetchRecipeAnalytics = async () => {
    setLoading(true);
    try {
      const recipesResponse = await recipeApi.getAll();
      const recipes = recipesResponse.items;

      if (recipes.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate average prep time
      const totalPrepTime = recipes.reduce((sum: number, recipe: any) =>
        sum + (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0), 0
      );
      const avgTime = Math.round(totalPrepTime / recipes.length);

      // Find most common difficulty
      const difficultyCounts: Record<string, number> = {};
      recipes.forEach((recipe: any) => {
        const difficulty = recipe.difficulty || 'medium';
        difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
      });
      const mostCommon = Object.entries(difficultyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      // Calculate average servings
      const totalServings = recipes.reduce((sum: number, recipe: any) =>
        sum + (recipe.servings || 0), 0
      );
      const avgServings = Math.round(totalServings / recipes.length);

      // Get top 5 recipes (by name for now, could be by usage frequency)
      const topFive = recipes.slice(0, 5);

      setStats({
        totalRecipes: recipes.length,
        avgPrepTime: avgTime,
        mostCommonDifficulty: mostCommon.charAt(0).toUpperCase() + mostCommon.slice(1),
        avgServings,
      });

      setTopRecipes(topFive);
    } catch (error) {
      console.error('Fetch recipe analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recipe Insights</h3>
          <p className="text-sm text-gray-600 mt-1">Overview of your recipe collection</p>
        </div>
        <div className="rounded-full bg-pink-100 p-2">
          <UtensilsCrossed className="h-5 w-5 text-pink-600" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-pink-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat className="h-4 w-4 text-pink-600" />
            <p className="text-sm font-medium text-pink-900">Total Recipes</p>
          </div>
          <p className="text-2xl font-bold text-pink-900">{stats.totalRecipes}</p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Avg Time</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.avgPrepTime}<span className="text-sm">m</span></p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4 text-orange-600" />
            <p className="text-sm font-medium text-orange-900">Difficulty</p>
          </div>
          <p className="text-xl font-bold text-orange-900">{stats.mostCommonDifficulty}</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <UtensilsCrossed className="h-4 w-4 text-green-600" />
            <p className="text-sm font-medium text-green-900">Avg Servings</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{stats.avgServings}</p>
        </div>
      </div>

      {/* Top Recipes */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Recipes</h4>
        <div className="space-y-2">
          {topRecipes.length > 0 ? (
            topRecipes.map((recipe, index) => (
              <div
                key={recipe.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-500 w-5">#{index + 1}</span>
                  <span className="text-sm font-medium text-gray-900 truncate">{recipe.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-gray-600">
                    {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)}m
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyColor(recipe.difficulty)}`}>
                    {recipe.difficulty || 'Medium'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No recipes yet</p>
          )}
        </div>
      </div>
    </Card>
  );
}
