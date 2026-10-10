'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeDetailModal } from '@/components/recipes/recipe-detail-modal';
import { FilterCard } from '@/components/recipes/cook/filter-card';
import { SubstituteSheet } from '@/components/recipes/cook/substitute-sheet';
import { CookEmptyState, CookListSkeleton } from '@/components/recipes/cook/cook-list-states';
import { useCookFromPantry } from '@/lib/hooks/use-cook-from-pantry';
import { relativeTimeAgo } from '@/lib/rules/relative-time';
import type { IngredientMatch } from '@/lib/rules';
import { CookResultsList } from './cook-results-list';

const INITIAL_VISIBLE = 50;

export default function CookFromPantryPage() {
  const router = useRouter();
  const [applyDiet, setApplyDiet] = useState(true);
  const [onlyReady, setOnlyReady] = useState(false);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [match, setMatch] = useState<IngredientMatch | null>(null);
  const [now] = useState(() => Date.now());

  const cook = useCookFromPantry({ applyDiet, onlyReady });
  const { status, result } = cook;
  const substituteResult = match ? cook.getSubstitutes(match) : null;
  const selectedRecipe = recipeId ? (cook.recipesById.get(recipeId) ?? null) : null;

  const actions: Partial<Record<typeof status, () => void>> = {
    emptyPantry: () => router.push('/pantry'),
    noRecipes: () => router.push('/recipes'),
    filteredOut: () => {
      setOnlyReady(false);
      setApplyDiet(false);
    },
    error: cook.refetch,
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Cook from what you have</h1>
        <p className="text-sm text-gray-600">
          Ranked by what is in your pantry. Works without internet.
        </p>
        {cook.dataUpdatedAt !== null && (
          <p className="text-sm text-gray-500">
            Based on pantry as of {relativeTimeAgo(cook.dataUpdatedAt, now)}
          </p>
        )}
      </header>

      <FilterCard
        dietRestrictions={cook.dietRestrictions}
        applyDiet={applyDiet}
        onlyReady={onlyReady}
        onToggleDiet={() => setApplyDiet((v) => !v)}
        onToggleReady={() => setOnlyReady((v) => !v)}
      />

      {status === 'loading' && <CookListSkeleton />}
      {status === 'ready' && result ? (
        <CookResultsList
          result={result}
          visible={visible}
          onShowMore={setVisible}
          onViewRecipe={setRecipeId}
          onFindSubstitute={setMatch}
        />
      ) : (
        status !== 'loading' && <CookEmptyState status={status} onAction={actions[status]} />
      )}

      <SubstituteSheet match={match} result={substituteResult} onClose={() => setMatch(null)} />
      <RecipeDetailModal
        isOpen={selectedRecipe !== null}
        onClose={() => setRecipeId(null)}
        recipe={selectedRecipe}
      />
    </div>
  );
}
