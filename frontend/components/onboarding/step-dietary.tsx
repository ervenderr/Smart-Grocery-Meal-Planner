'use client';

import { Check } from 'lucide-react';
import { DIETARY_OPTIONS } from '@/lib/constants/dietary';
import { cn } from '@/lib/utils';

export const DIETARY_STEP_TITLE = 'Any dietary needs?';

interface StepDietaryProps {
  selected: ReadonlyArray<string>;
  onToggle: (value: string) => void;
}

export function StepDietary({ selected, onToggle }: StepDietaryProps) {
  return (
    <div className="space-y-6">
      <p className="text-base text-gray-600">
        We&apos;ll filter recipes and AI suggestions to match. You can change this anytime in
        Settings.
      </p>
      <div role="group" aria-label="Dietary needs" className="flex flex-wrap gap-2">
        {DIETARY_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(option.value)}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-700'
              )}
            >
              {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-gray-600">None selected means no restrictions</p>
    </div>
  );
}
