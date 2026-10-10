'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pantryApi } from '@/lib/api/pantry';
import { recipeApi } from '@/lib/api/recipes';
import { queryKeys } from '@/lib/react-query';
import { localDateString } from '@/lib/recipes/cook-first';
import {
  PAGE_SIZE,
  PANTRY_CAP,
  RECIPE_CAP,
  deriveCookStatus,
  derivePrefsState,
  fetchAllPages,
  normalizePantry,
  normalizeRecipes,
  type CookStatus,
} from '@/lib/rules/cook-data';
import {
  buildPantryIndex,
  findSubstitutes,
  hasSubstitute,
  pantryHas,
  rankRecipes,
  resolveStapleSet,
  type IngredientMatch,
  type RankResult,
  type SubstituteResult,
} from '@/lib/rules';
import { usePreferences } from '@/lib/hooks/use-preferences';
import type { Recipe } from '@/types/recipe.types';

export const COOK_PANTRY_KEY = [...queryKeys.pantry.all, 'all-pages'] as const;
export const COOK_RECIPES_KEY = [...queryKeys.recipes.all, 'all-pages'] as const;

const OFFLINE_GC_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 5 * 60 * 1000;
const EMPTY_LIST: readonly string[] = Object.freeze([]);
const EMPTY_MAP: ReadonlyMap<string, Recipe> = new Map();

const queryOptions = {
  gcTime: OFFLINE_GC_MS,
  staleTime: STALE_MS,
  retry: 1,
} as const;

interface Options {
  applyDiet: boolean;
  onlyReady: boolean;
}

export interface UseCookFromPantry {
  status: CookStatus;
  result: RankResult | null;
  recipesById: ReadonlyMap<string, Recipe>;
  dietRestrictions: readonly string[];
  /** True when saved preferences could not be loaded, so diet filtering is NOT applied. */
  prefsUnavailable: boolean;
  dataUpdatedAt: number | null;
  getSubstitutes: (match: IngredientMatch) => SubstituteResult | null;
  refetch: () => void;
}

function safeRank(run: () => RankResult): { result: RankResult | null; failed: boolean } {
  try {
    return { result: run(), failed: false };
  } catch {
    return { result: null, failed: true };
  }
}

export function useCookFromPantry({ applyDiet, onlyReady }: Options): UseCookFromPantry {
  const pantryQuery = useQuery({
    queryKey: COOK_PANTRY_KEY,
    queryFn: () =>
      fetchAllPages((page, limit) => pantryApi.getAll({ page, limit }), {
        limit: PAGE_SIZE,
        cap: PANTRY_CAP,
      }),
    networkMode: 'offlineFirst',
    ...queryOptions,
  });
  const recipesQuery = useQuery({
    queryKey: COOK_RECIPES_KEY,
    queryFn: () =>
      fetchAllPages((page, limit) => recipeApi.getAll({ page, limit }), {
        limit: PAGE_SIZE,
        cap: RECIPE_CAP,
      }),
    networkMode: 'offlineFirst',
    ...queryOptions,
  });
  const prefsQuery = usePreferences();
  const prefs = prefsQuery.data;

  const pantryRaw = pantryQuery.data?.items;
  const recipesRaw = recipesQuery.data?.items;
  const pantry = useMemo(() => normalizePantry(pantryRaw), [pantryRaw]);
  const recipes = useMemo(() => normalizeRecipes(recipesRaw), [recipesRaw]);
  const recipesById = useMemo(
    () =>
      recipesRaw ? new Map((recipesRaw as Recipe[]).map((r) => [r.id, r] as const)) : EMPTY_MAP,
    [recipesRaw]
  );

  const restrictions = prefs?.dietaryRestrictions ?? EMPTY_LIST;
  const prefsState = derivePrefsState({
    hasPrefs: Boolean(prefs),
    fetchStatus: prefsQuery.fetchStatus,
  });
  const prefsUnavailable = prefsState === 'unavailable';
  const stapleNames = prefs?.stapleNames;
  const defaultStapleNames = prefs?.defaultStapleNames;
  const staples = useMemo(
    () => resolveStapleSet(stapleNames, defaultStapleNames),
    [stapleNames, defaultStapleNames]
  );
  const today = useMemo(() => localDateString(), []);

  const ranking = useMemo(() => {
    if (!pantryRaw || !recipesRaw) return { result: null, failed: false };
    return safeRank(() =>
      rankRecipes(recipes, pantry, {
        today,
        staples,
        restrictions,
        applyDiet,
        onlyReady,
        hasSubstitute,
      })
    );
  }, [pantryRaw, recipesRaw, recipes, pantry, restrictions, staples, today, applyDiet, onlyReady]);

  const index = useMemo(() => buildPantryIndex(pantry, today), [pantry, today]);

  const getSubstitutes = useCallback(
    (match: IngredientMatch): SubstituteResult | null =>
      findSubstitutes(
        { ingredientName: match.name, quantity: match.needed, unit: match.unit },
        { pantryHas: (c) => pantryHas(index, c), restrictions }
      ),
    [index, restrictions]
  );

  const hasData = Boolean(pantryQuery.data && recipesQuery.data);
  // Wait for preferences before ranking so allergens are never briefly unfiltered.
  const paused = pantryQuery.fetchStatus === 'paused' || recipesQuery.fetchStatus === 'paused';
  const fetching =
    pantryQuery.fetchStatus === 'fetching' || recipesQuery.fetchStatus === 'fetching';
  const derived = deriveCookStatus({
    hasData,
    fetchStatus: paused ? 'paused' : fetching ? 'fetching' : 'idle',
    isError: pantryQuery.isError || recipesQuery.isError,
    pantryCount: pantry.length,
    recipeCount: recipes.length,
    itemCount: ranking.result?.items.length ?? 0,
    filtersActive: applyDiet || onlyReady,
    engineFailed: ranking.failed,
  });

  const status: CookStatus = hasData && prefsState === 'loading' ? 'loading' : derived;

  const refetchPantry = pantryQuery.refetch;
  const refetchRecipes = recipesQuery.refetch;
  const refetch = useCallback(() => {
    void refetchPantry();
    void refetchRecipes();
  }, [refetchPantry, refetchRecipes]);

  const updatedAt = Math.min(
    pantryQuery.dataUpdatedAt || Number.POSITIVE_INFINITY,
    recipesQuery.dataUpdatedAt || Number.POSITIVE_INFINITY
  );

  return {
    status,
    result: ranking.result,
    recipesById,
    dietRestrictions: restrictions,
    prefsUnavailable,
    dataUpdatedAt: hasData && Number.isFinite(updatedAt) ? updatedAt : null,
    getSubstitutes,
    refetch,
  };
}
