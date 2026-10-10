import { ArrowRightLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatExpiryLabel } from '@/lib/pantry/expiry';
import { formatMatchLine } from '@/lib/rules/view-model';
import type { IngredientMatch, RankedRecipe } from '@/lib/rules';

interface IngredientGroupsProps {
  readonly ranked: RankedRecipe;
  readonly onFindSubstitute: (match: IngredientMatch) => void;
}

const HEADER = 'text-sm font-semibold text-gray-900';

export function IngredientGroups({ ranked, onFindSubstitute }: IngredientGroupsProps) {
  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      {ranked.have.length > 0 && (
        <section>
          <h3 className={HEADER}>In your pantry</h3>
          <ul className="mt-2 space-y-2">
            {ranked.have.map((m) => (
              <li key={`have-${m.canonical}-${m.name}`} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                <span className="min-w-0 text-base text-gray-900">
                  {m.name}
                  <span className="block text-sm text-gray-600">{formatMatchLine(m)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranked.expiringUsed.length > 0 && (
        <section>
          <h3 className={HEADER}>Using up soon</h3>
          <ul className="mt-2 space-y-2">
            {ranked.expiringUsed.map((e) => (
              <li key={`exp-${e.name}`} className="text-base text-amber-800">
                {e.name}
                <span className="block text-sm">{formatExpiryLabel(e.daysLeft)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranked.missing.length > 0 && (
        <section>
          <h3 className={HEADER}>Missing</h3>
          <ul className="mt-2 space-y-2">
            {ranked.missing.map((m) => (
              <li
                key={`missing-${m.canonical}-${m.name}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 text-base text-gray-900">
                  {m.name}
                  <span className="block text-sm text-gray-600">{formatMatchLine(m)}</span>
                </span>
                {m.hasSubstitute && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    aria-label={`Find substitute for ${m.name}`}
                    onClick={() => onFindSubstitute(m)}
                  >
                    <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                    Find substitute
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
