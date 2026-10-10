'use client';

import { memo, useId, useState } from 'react';
import { ChevronDown, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildRowViewModel, type RowPill } from '@/lib/rules/view-model';
import type { IngredientMatch, RankedRecipe } from '@/lib/rules';
import { CoverageBar } from './coverage-bar';
import { IngredientGroups } from './ingredient-groups';

interface RecipeRowProps {
  readonly ranked: RankedRecipe;
  readonly onViewRecipe: (recipeId: string) => void;
  readonly onFindSubstitute: (match: IngredientMatch) => void;
}

const PILL_CLASSES: Record<RowPill['kind'], string> = {
  ready: 'bg-green-100 text-green-800',
  missing: 'bg-gray-100 text-gray-700',
  expiring: 'bg-amber-100 text-amber-800',
};

function RecipeRowImpl({ ranked, onViewRecipe, onFindSubstitute }: RecipeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const vm = buildRowViewModel(ranked);

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-sm font-semibold text-gray-500">{ranked.rank}</span>
          <h2 className="line-clamp-2 min-w-0 text-base font-semibold text-gray-900">
            {ranked.name}
          </h2>
        </div>

        <CoverageBar percent={ranked.coveragePercent} label={vm.progressLabel} />
        <p className="text-sm text-gray-700">{vm.coverageText}</p>

        <ul className="flex flex-wrap gap-2">
          {vm.pills.map((pill) => (
            <li
              key={`${pill.kind}-${pill.label}`}
              className={`rounded-full px-2 py-1 text-sm font-semibold ${PILL_CLASSES[pill.kind]}`}
            >
              {pill.label}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {ranked.totalTimeMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {ranked.totalTimeMinutes} min
            </span>
          )}
          {ranked.servings > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden="true" />
              {ranked.servings} servings
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          fullWidth
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide details' : 'Why this ranking'}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </Button>

        <div id={detailId}>
          {expanded && <IngredientGroups ranked={ranked} onFindSubstitute={onFindSubstitute} />}
        </div>

        <Button variant="outline" fullWidth onClick={() => onViewRecipe(ranked.recipeId)}>
          View recipe
        </Button>
      </div>
    </Card>
  );
}

export const RecipeRow = memo(RecipeRowImpl);
