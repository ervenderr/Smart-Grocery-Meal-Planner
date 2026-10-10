'use client';

import { Modal } from '@/components/ui/modal';
import { substituteContextLine } from '@/lib/rules/view-model';
import type { IngredientMatch, SubstituteResult } from '@/lib/rules';
import { SwapCard } from './swap-card';

interface SubstituteSheetProps {
  readonly match: IngredientMatch | null;
  readonly result: SubstituteResult | null;
  readonly onClose: () => void;
}

export function SubstituteSheet({ match, result, onClose }: SubstituteSheetProps) {
  const swaps = result?.swaps ?? [];
  const hiddenCount = result?.hiddenCount ?? 0;

  return (
    <Modal
      isOpen={match !== null}
      onClose={onClose}
      title={match ? `Substitute for ${match.name}` : 'Substitute'}
      size="md"
    >
      {match && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{substituteContextLine(match)}</p>
          <p>
            <span className="inline-block rounded-full bg-gray-100 px-2 py-1 text-sm font-semibold text-gray-700">
              Built-in swaps - no internet needed
            </span>
          </p>

          {swaps.length > 0 && (
            <ul className="space-y-4">
              {swaps.map((swap) => (
                <SwapCard key={`${swap.rank}-${swap.name}`} swap={swap} />
              ))}
            </ul>
          )}

          {swaps.length === 0 && hiddenCount > 0 && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-base font-semibold text-gray-900">No safe swaps found</h3>
              <p className="mt-1 text-base text-gray-600">
                Every built-in swap conflicts with your dietary settings. Try leaving this
                ingredient out or buying it.
              </p>
            </div>
          )}

          {hiddenCount > 0 && (
            <p className="text-sm text-gray-500">{hiddenCount} hidden by your dietary settings</p>
          )}

          <p className="text-sm text-gray-500">
            Swaps are general guidance. Check labels if you have allergies.
          </p>
        </div>
      )}
    </Modal>
  );
}
