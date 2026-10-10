'use client';

import { Button } from '@/components/ui/button';
import { RecipeRow } from '@/components/recipes/cook/recipe-row';
import { truncationNote } from '@/lib/rules/view-model';
import type { IngredientMatch, RankResult } from '@/lib/rules';

const SHOW_MORE_STEP = 50;

interface CookResultsListProps {
  readonly result: RankResult;
  readonly visible: number;
  readonly onShowMore: (nextVisible: number) => void;
  readonly onViewRecipe: (recipeId: string) => void;
  readonly onFindSubstitute: (match: IngredientMatch) => void;
}

export function CookResultsList({
  result,
  visible,
  onShowMore,
  onViewRecipe,
  onFindSubstitute,
}: CookResultsListProps) {
  const shown = result.items.slice(0, visible);
  const note = truncationNote(result.items.length, shown.length);

  return (
    <>
      <ul className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {shown.map((ranked) => (
          <li key={ranked.recipeId} className="min-w-0">
            <RecipeRow
              ranked={ranked}
              onViewRecipe={onViewRecipe}
              onFindSubstitute={onFindSubstitute}
            />
          </li>
        ))}
      </ul>
      {note && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{note}</p>
          <Button variant="outline" onClick={() => onShowMore(visible + SHOW_MORE_STEP)}>
            Show more recipes
          </Button>
        </div>
      )}
      {result.recipesCapped && (
        <p className="text-sm text-gray-500">Only your first 500 recipes are ranked.</p>
      )}
    </>
  );
}
