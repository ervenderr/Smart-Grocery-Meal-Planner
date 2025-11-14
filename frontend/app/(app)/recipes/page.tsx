'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { AddRecipeModal } from '@/components/recipes/add-recipe-modal';
import { EditRecipeModal } from '@/components/recipes/edit-recipe-modal';
import { RecipeDetailModal } from '@/components/recipes/recipe-detail-modal';
import { AIRecipeSuggestionsModal } from '@/components/ai/ai-recipe-suggestions-modal';
import { RecipeCard } from '@/components/recipes/recipe-card';
import { recipeApi } from '@/lib/api/recipes';
import toast from 'react-hot-toast';
import type { Recipe, RecipeFilters } from '@/types/recipe.types';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<RecipeFilters>({
    category: undefined,
    difficulty: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAISuggestionsModal, setShowAISuggestionsModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Recipe | null>(null);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const response = await recipeApi.getAll({
        ...filters,
        search: searchQuery || undefined,
      });
      setRecipes(response.items || []);
    } catch (error: any) {
      console.error('Fetch recipes error:', error);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [filters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecipes();
  };

  const handleView = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowDetailModal(true);
  };

  const handleEdit = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowEditModal(true);
  };

  const handleDelete = async (recipe: Recipe) => {
    if (deleteConfirm?.id === recipe.id) {
      try {
        await recipeApi.delete(recipe.id);
        toast.success('Recipe deleted successfully');
        fetchRecipes();
        setDeleteConfirm(null);
      } catch (error: any) {
        console.error('Delete error:', error);
        toast.error('Failed to delete recipe');
      }
    } else {
      setDeleteConfirm(recipe);
      setTimeout(() => setDeleteConfirm(null), 3000);
      toast('Click delete again to confirm', { icon: '⚠️' });
    }
  };

  const handleFilterChange = (key: keyof RecipeFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Recipes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage your recipe collection
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAISuggestionsModal(true)}>
            <Sparkles className="h-4 w-4" />
            AI Suggestions
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            Add Recipe
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Search */}
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </form>

          {/* Filter Row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Select
              value={filters.category || ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
              <option value="dessert">Dessert</option>
              <option value="beverage">Beverage</option>
            </Select>

            <Select
              value={filters.difficulty || ''}
              onChange={(e) => handleFilterChange('difficulty', e.target.value)}
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>

            <Select
              value={filters.sortBy || 'createdAt'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="createdAt">Newest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="totalTime">Total Time</option>
              <option value="prepTime">Prep Time</option>
              <option value="cookTime">Cook Time</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Recipes Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : recipes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <BookOpen className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No recipes found</h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchQuery || filters.category || filters.difficulty
              ? 'Try adjusting your filters'
              : 'Get started by adding your first recipe'}
          </p>
          {!searchQuery && !filters.category && !filters.difficulty && (
            <Button onClick={() => setShowAddModal(true)} className="mt-4">
              <Plus className="h-4 w-4" />
              Add Your First Recipe
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddRecipeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchRecipes}
      />

      <EditRecipeModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedRecipe(null);
        }}
        onSuccess={fetchRecipes}
        recipe={selectedRecipe}
      />

      <RecipeDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRecipe(null);
        }}
        recipe={selectedRecipe}
      />

      <AIRecipeSuggestionsModal
        isOpen={showAISuggestionsModal}
        onClose={() => setShowAISuggestionsModal(false)}
        onRecipeAdded={fetchRecipes}
      />
    </div>
  );
}
