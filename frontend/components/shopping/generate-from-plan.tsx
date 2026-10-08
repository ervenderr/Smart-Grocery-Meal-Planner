'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { mealPlanApi } from '@/lib/api/mealplans';
import { useGenerateShoppingList } from '@/lib/hooks/use-generate-shopping-list';
import { queryKeys } from '@/lib/react-query';

const RECENT_PLANS_LIMIT = 10;
const CONTENT_ID = 'generate-from-plan-content';

interface GenerateFromPlanProps {
  defaultExpanded: boolean;
}

function formatRange(start: string, end: string): string {
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}

export function GenerateFromPlan({ defaultExpanded }: GenerateFromPlanProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const generate = useGenerateShoppingList();
  const plans = useQuery({
    queryKey: [...queryKeys.mealPlans.all, 'recent-for-shopping'],
    queryFn: () =>
      mealPlanApi.getAll({ sortBy: 'startDate', sortOrder: 'desc', limit: RECENT_PLANS_LIMIT }),
    enabled: expanded,
  });
  const items = plans.data?.items ?? [];

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <h2 className="m-0">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={CONTENT_ID}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-base font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Add from a meal plan
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      {expanded && (
        <div id={CONTENT_ID} className="px-4 pb-3">
          {plans.isLoading ? (
            <div className="flex justify-center py-3">
              <LoadingSpinner size="sm" />
            </div>
          ) : plans.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-gray-600">Couldn&apos;t load your meal plans.</p>
              <Button variant="outline" size="sm" onClick={() => void plans.refetch()}>
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-600">
              No meal plans yet.{' '}
              <Link href="/mealplans" className="text-primary-600 underline">
                Go to meal plans
              </Link>
            </p>
          ) : (
            <ul>
              {items.map((plan) => {
                const pending = generate.isPending && generate.variables === plan.id;
                return (
                  <li
                    key={plan.id}
                    className="flex items-center justify-between gap-3 border-t border-gray-100 py-2 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base text-gray-900">{plan.name}</p>
                      <p className="text-sm text-gray-600">
                        {formatRange(plan.startDate, plan.endDate)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={generate.isPending}
                      onClick={() => generate.mutate(plan.id)}
                    >
                      {pending ? 'Adding...' : 'Add to list'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
