'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';
import { buildGenerateNotes, type LastGenerateResult } from '@/lib/shopping/covered-note';

const CONTENT_ID = 'pantry-note-content';

interface PantryNoteProps {
  /** When set, only show the note if it belongs to this meal plan. */
  mealPlanId?: string;
}

export function PantryNote({ mealPlanId }: PantryNoteProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  // Cache-only read: the value is written by useGenerateShoppingList.
  const { data } = useQuery<LastGenerateResult | null>({
    queryKey: queryKeys.shopping.lastGenerate(),
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (!data || (mealPlanId !== undefined && data.mealPlanId !== mealPlanId)) return null;
  const { coveredLines, skippedText, cappedText, hasNotes } = buildGenerateNotes(data);
  if (!hasNotes) return null;

  return (
    <section
      aria-label="Pantry notes"
      className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2"
    >
      {cappedText && <p className="py-2 text-sm text-amber-700">{cappedText}</p>}
      {coveredLines.length > 0 && (
        <div>
          <h2 className="m-0">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-controls={CONTENT_ID}
              className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-base font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {`Already in your pantry (${coveredLines.length})`}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </h2>
          {expanded && (
            <ul id={CONTENT_ID} className="space-y-2 pb-2 text-sm text-gray-700">
              {coveredLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {skippedText && (
        <div className="flex flex-wrap items-center gap-2 py-2">
          <p className="text-sm text-gray-700">Skipped staples: {skippedText}</p>
          <Link
            href="/settings?tab=preferences"
            className="inline-flex min-h-11 items-center text-sm text-primary-600 underline"
          >
            Edit staples
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => queryClient.setQueryData(queryKeys.shopping.lastGenerate(), null)}
        className="min-h-11 text-sm text-gray-600 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Dismiss
      </button>
    </section>
  );
}
