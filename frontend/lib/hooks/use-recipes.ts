'use client';

import { useQuery } from '@tanstack/react-query';
import { recipeApi } from '@/lib/api/recipes';
import { fetchAllPages } from '@/lib/api/fetch-all-pages';
import { RECIPES_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import { filterRecipes, type RecipeListFilters } from '@/lib/recipes/filter-recipes';

/** Full recipe list on the canonical (persisted) key; filtering and sorting run in memory. */
export function useRecipesList(filters: RecipeListFilters = {}) {
  const { search, category, difficulty, sortBy, sortOrder } = filters;
  return useQuery({
    queryKey: RECIPES_ALL_KEY,
    queryFn: () => fetchAllPages((page, limit) => recipeApi.getAll({ page, limit })),
    select: (recipes) => filterRecipes(recipes, { search, category, difficulty, sortBy, sortOrder }),
  });
}
