import type { Recipe, RecipeFilters } from '@/types/recipe.types';

export type RecipeListFilters = Pick<
  RecipeFilters,
  'search' | 'category' | 'difficulty' | 'sortBy' | 'sortOrder'
>;

const sortValue = (recipe: Recipe, sortBy: RecipeListFilters['sortBy']): number | string => {
  switch (sortBy) {
    case 'name':
      return recipe.name.toLowerCase();
    case 'prepTime':
      return recipe.prepTimeMinutes;
    case 'cookTime':
      return recipe.cookTimeMinutes;
    case 'totalTime':
      return recipe.prepTimeMinutes + recipe.cookTimeMinutes;
    default:
      return recipe.createdAt;
  }
};

/** Mirrors the server-side recipe list filter and sort (search matches name and description). */
export function filterRecipes(
  recipes: readonly Recipe[],
  filters: RecipeListFilters,
): Recipe[] {
  const term = filters.search?.trim().toLowerCase();
  const direction = filters.sortOrder === 'asc' ? 1 : -1;
  return recipes
    .filter((recipe) => {
      if (filters.category && recipe.category !== filters.category) return false;
      if (filters.difficulty && recipe.difficulty !== filters.difficulty) return false;
      if (!term) return true;
      return (
        recipe.name.toLowerCase().includes(term) ||
        (recipe.description ?? '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const left = sortValue(a, filters.sortBy);
      const right = sortValue(b, filters.sortBy);
      if (left === right) return 0;
      return (left < right ? -1 : 1) * direction;
    });
}
