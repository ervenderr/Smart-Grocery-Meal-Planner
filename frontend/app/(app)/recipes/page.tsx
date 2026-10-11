'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, UtensilsCrossed, AlertCircle, Sparkles, ChefHat } from 'lucide-react';
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
import { NeedsConnection } from '@/components/offline/needs-connection';
import { recipeApi } from '@/lib/api/recipes';
import { useQueryClient } from '@tanstack/react-query';
import { useRecipesList } from '@/lib/hooks/use-recipes';
import { RECIPES_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import toast from 'react-hot-toast';
import {
  RECIPES_CAPPED_NOTE,
  expiringBadge,
  filterCookFirstEntries,
  localDateString,
} from '@/lib/recipes/cook-first';
import type { Recipe, RecipeFilters } from '@/types/recipe.types';

const RECIPES_PAGE_SIZE = 50;

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
  const queryClient = useQueryClient();
  const [expiringSort, setExpiringSort] = useState(false);
  const [cookFirst, setCookFirst] = useState<{
    recipes: Recipe[];
    badges: Map<string, string>;
    capped: boolean;
    loading: boolean;
    error: boolean;
  }>({ recipes: [], badges: new Map(), capped: false, loading: false, error: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filters, setFilters] = useState<RecipeFilters>({
    category: undefined,
    difficulty: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const list = useRecipesList({ ...filters, search: appliedSearch || undefined });
  const recipes = expiringSort
    ? cookFirst.recipes
    : (list.data ?? []).slice(0, RECIPES_PAGE_SIZE);
  const loading = expiringSort ? cookFirst.loading : list.isPending;
  const loadError = expiringSort ? cookFirst.error : list.isError && !list.data;
  const badges = expiringSort ? cookFirst.badges : new Map<string, string>();
  const recipesCapped = expiringSort && cookFirst.capped;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAISuggestionsModal, setShowAISuggestionsModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Recipe | null>(null);

  // "Use expiring first" is an online ranking; failures fall back to the error state.
  const fetchCookFirst = async (search: string = appliedSearch) => {
    setCookFirst((prev) => ({ ...prev, loading: true, error: false }));
    try {
      const result = await recipeApi.getCookFirst({
        includeAll: true,
        today: localDateString(),
      });
      const entries = filterCookFirstEntries(result.items, {
        search,
        category: filters.category,
        difficulty: filters.difficulty,
      });
      const next = new Map<string, string>();
      entries.forEach((entry) => {
        const badge = expiringBadge(entry);
        if (badge) next.set(entry.recipe.id, badge);
      });
      setCookFirst({
        recipes: entries.map((entry) => entry.recipe),
        badges: next,
        capped: result.recipesCapped === true,
        loading: false,
        error: false,
      });
    } catch (error: any) {
      console.error('Fetch recipes error:', error);
      setCookFirst((prev) => ({ ...prev, loading: false, error: true }));
      toast.error('Failed to load recipes');
    }
  };

  const refreshRecipes = () => {
    void queryClient.invalidateQueries({ queryKey: RECIPES_ALL_KEY });
    if (expiringSort) void fetchCookFirst();
  };

  useEffect(() => {
    if (expiringSort) void fetchCookFirst();
  }, [filters, expiringSort]);

  useEffect(() => {
    if (searchParams.get('ai') === 'suggestions') {
      setShowAISuggestionsModal(true);
      router.replace('/recipes');
    }
  }, [searchParams, router]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setAppliedSearch('');
    setFilters({ ...filters, category: undefined, difficulty: undefined });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchQuery);
    if (expiringSort) void fetchCookFirst(searchQuery);
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
        refreshRecipes();
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
          <Button variant="outline" onClick={() => router.push('/recipes/cook')}>
            <ChefHat className="h-4 w-4" />
            Cook from what you have
          </Button>
          <NeedsConnection>
            {(disabled, describedById) => (
              <Button
                variant="outline"
                onClick={() => setShowAISuggestionsModal(true)}
                disabled={disabled}
                aria-describedby={describedById}
              >
                <Sparkles className="h-4 w-4" />
                AI Suggestions
              </Button>
            )}
          </NeedsConnection>
          <NeedsConnection>
            {(disabled, describedById) => (
              <Button
                onClick={() => setShowAddModal(true)}
                disabled={disabled}
                aria-describedby={describedById}
              >
                <Plus className="h-4 w-4" />
                Add Recipe
              </Button>
            )}
          </NeedsConnection>
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

      {expiringSort && recipesCapped && (
        <p className="text-xs text-gray-600">{RECIPES_CAPPED_NOTE}</p>
      )}

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
          onAction={() => (expiringSort ? void fetchCookFirst() : void list.refetch())}
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
        onSuccess={refreshRecipes}
      />

      <EditRecipeModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedRecipe(null);
        }}
        onSuccess={refreshRecipes}
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
        onRecipeAdded={refreshRecipes}
      />
    </div>
  );
}
