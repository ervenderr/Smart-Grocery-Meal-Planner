'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, UtensilsCrossed, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { AddRecipeModal } from '@/components/recipes/add-recipe-modal';
import { EditRecipeModal } from '@/components/recipes/edit-recipe-modal';
import { RecipeDetailModal } from '@/components/recipes/recipe-detail-modal';
import { AIRecipeSuggestionsModal } from '@/components/ai/ai-recipe-suggestions-modal';
import { RecipeCard } from '@/components/recipes/recipe-card';
import { recipeApi } from '@/lib/api/recipes';
import toast from 'react-hot-toast';
import {
  expiringBadge,
  filterCookFirstEntries,
  localDateString,
} from '@/lib/recipes/cook-first';
import type { Recipe, RecipeFilters } from '@/types/recipe.types';

const CATEGORY_CHIPS = [
  { value: '', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'beverage', label: 'Beverage' },
];

export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <RecipesPageContent />
    </Suspense>
  );
}

function RecipesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expiringSort, setExpiringSort] = useState(false);
  const [badges, setBadges] = useState<Map<string, string>>(new Map());
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

  const fetchRecipes = async (
    activeFilters: RecipeFilters = filters,
    search: string = searchQuery,
    byExpiring: boolean = expiringSort
  ) => {
    setLoading(true);
    setLoadError(false);
    try {
      if (byExpiring) {
        const result = await recipeApi.getCookFirst({
          includeAll: true,
          today: localDateString(),
        });
        const entries = filterCookFirstEntries(result.items, {
          search,
          category: activeFilters.category,
          difficulty: activeFilters.difficulty,
        });
        const next = new Map<string, string>();
        entries.forEach((entry) => {
          const badge = expiringBadge(entry);
          if (badge) next.set(entry.recipe.id, badge);
        });
        setBadges(next);
        setRecipes(entries.map((entry) => entry.recipe));
        return;
      }
      setBadges(new Map());
      const response = await recipeApi.getAll({
        ...activeFilters,
        search: search || undefined,
      });
      setRecipes(response.items || []);
    } catch (error: any) {
      console.error('Fetch recipes error:', error);
      setLoadError(true);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [filters, expiringSort]);

  useEffect(() => {
    if (searchParams.get('ai') === 'suggestions') {
      setShowAISuggestionsModal(true);
      router.replace('/recipes');
    }
  }, [searchParams, router]);

  const handleClearFilters = () => {
    const cleared: RecipeFilters = {
      ...filters,
      category: undefined,
      difficulty: undefined,
    };
    setSearchQuery('');
    setFilters(cleared);
    fetchRecipes(cleared, '');
  };

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

  const handleSortChange = (value: string) => {
    if (value === 'expiring') {
      setExpiringSort(true);
      return;
    }
    setExpiringSort(false);
    handleFilterChange('sortBy', value);
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
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-base lg:text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </form>

          {/* Filter Row */}
          <div
            role="group"
            aria-label="Filter by category"
            className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1"
          >
            {CATEGORY_CHIPS.map((chip) => {
              const active = (filters.category || '') === chip.value;
              return (
                <button
                  key={chip.value || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleFilterChange('category', chip.value)}
                  className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                    active
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">

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
              value={expiringSort ? 'expiring' : filters.sortBy || 'createdAt'}
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="createdAt">Newest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="totalTime">Total Time</option>
              <option value="prepTime">Prep Time</option>
              <option value="cookTime">Cook Time</option>
              <option value="expiring">Use expiring first</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Recipes Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : loadError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load your recipes"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => fetchRecipes()}
        />
      ) : recipes.length === 0 ? (
        searchQuery || filters.category || filters.difficulty ? (
          <EmptyState
            icon={Search}
            title="No matching recipes"
            description="Try a different search or clear the filters."
            actionLabel="Clear filters"
            onAction={handleClearFilters}
          />
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            title="No recipes yet"
            description="Save your favorite recipes or ask AI for ideas based on your pantry."
            actionLabel="Add a recipe"
            onAction={() => setShowAddModal(true)}
            secondaryActionLabel="Get AI suggestions"
            onSecondaryAction={() => setShowAISuggestionsModal(true)}
          />
        )
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              badge={expiringSort ? badges.get(recipe.id) ?? null : null}
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
        onSuccess={() => fetchRecipes()}
      />

      <EditRecipeModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedRecipe(null);
        }}
        onSuccess={() => fetchRecipes()}
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
        onRecipeAdded={() => fetchRecipes()}
      />
    </div>
  );
}
