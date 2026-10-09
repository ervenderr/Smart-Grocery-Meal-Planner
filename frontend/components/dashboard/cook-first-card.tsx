'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChefHat } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { recipeApi } from '@/lib/api/recipes';
import { formatExpiryLabel } from '@/lib/pantry/expiry';
import { COOK_FIRST_QUERY_KEY, localDateString } from '@/lib/recipes/cook-first';

const CARD_LIMIT = 3;

/**
 * Self-contained dashboard card. Its own query means a failing or missing
 * endpoint can never break the rest of the Home tab.
 */
export function CookFirstCard() {
  const router = useRouter();
  const today = useMemo(() => localDateString(), []);
  const { data, isLoading, isError } = useQuery({
    queryKey: COOK_FIRST_QUERY_KEY(today, CARD_LIMIT, false),
    queryFn: () => recipeApi.getCookFirst({ limit: CARD_LIMIT, today, includeAll: false }),
    retry: 1,
  });

  const entries = (data?.items ?? [])
    .filter((entry) => entry.usesExpiring.length > 0)
    .slice(0, CARD_LIMIT);

  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Cook this first</h2>
      {isLoading ? (
        <p className="text-sm text-gray-500">Checking your pantry...</p>
      ) : isError ? (
        <p className="text-sm text-gray-500">Suggestions are unavailable right now.</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="Nothing expiring that your recipes use"
          description="Recipes that use soon-to-expire pantry items show up here."
          headingLevel="h3"
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.recipe.id}>
              <button
                type="button"
                onClick={() => router.push('/recipes')}
                className="flex min-h-11 w-full min-w-0 flex-col gap-1 rounded-lg bg-gray-50 p-2 text-left hover:bg-gray-100"
              >
                <span className="truncate font-semibold text-gray-900">{entry.recipe.name}</span>
                <span className="text-sm text-amber-700">
                  {entry.usesExpiring
                    .map((use) => `${use.name} (${formatExpiryLabel(use.daysLeft)})`)
                    .join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
