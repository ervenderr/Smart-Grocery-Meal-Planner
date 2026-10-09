'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatQuantity } from '@/lib/pantry/quantity';
import type { CookRow } from '@/types/cook.types';

interface CookNotesProps {
  notInPantry: readonly string[];
  mismatches: readonly CookRow[];
  staples: readonly string[];
  disabled: boolean;
  onEnterAmount: (key: string) => void;
}

const COLLAPSE_AFTER = 5;

export function CookNotes({ notInPantry, mismatches, staples, disabled, onEnterAmount }: CookNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const hidden = notInPantry.length - COLLAPSE_AFTER;
  const visible = expanded || hidden <= 0 ? notInPantry : notInPantry.slice(0, COLLAPSE_AFTER);

  return (
    <div className="space-y-3">
      {notInPantry.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Not in your pantry (skipped)
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {visible.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {hidden > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 flex h-11 items-center text-sm font-semibold text-amber-900 underline"
            >
              {hidden} more
            </button>
          )}
        </div>
      )}

      {mismatches.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Different units (skipped)
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {mismatches.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  {`${row.name}: recipe uses ${formatQuantity(row.recipeQuantity ?? 0)} ${row.recipeUnit ?? ''}, pantry has ${formatQuantity(row.have)} ${row.unit}`}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onEnterAmount(row.key)}
                  className="flex h-11 items-center text-sm font-semibold text-amber-900 underline disabled:opacity-50"
                >
                  Enter amount
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {staples.length > 0 && (
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Staples (not deducted)</span>: {staples.join(', ')}
        </p>
      )}
    </div>
  );
}
