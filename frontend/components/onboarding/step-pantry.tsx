'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MAX_ONBOARDING_ITEMS,
  PANTRY_SUGGESTIONS,
  addOnboardingItem,
  removeOnboardingItem,
} from '@/lib/onboarding/onboarding';
import { cn } from '@/lib/utils';

export const PANTRY_STEP_TITLE = "What's in your pantry?";

interface StepPantryProps {
  items: ReadonlyArray<string>;
  onItemsChange: (items: string[]) => void;
}

export function StepPantry({ items, onItemsChange }: StepPantryProps) {
  const [draft, setDraft] = useState('');
  const atMax = items.length >= MAX_ONBOARDING_ITEMS;

  const addDraft = () => {
    onItemsChange(addOnboardingItem(items, draft));
    setDraft('');
  };

  return (
    <div className="space-y-6">
      <p className="text-base text-gray-600">
        Add a few items to get expiry alerts and recipe ideas. You can add more later.
      </p>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addDraft();
        }}
      >
        <Input
          label="Item name"
          value={draft}
          maxLength={100}
          disabled={atMax}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={atMax || draft.trim() === ''}>
          Add
        </Button>
      </form>
      <div role="group" aria-label="Suggestions" className="flex flex-wrap gap-2">
        {PANTRY_SUGGESTIONS.map((s) => {
          const added = items.some((n) => n.toLowerCase() === s.name.toLowerCase());
          return (
            <button
              key={s.name}
              type="button"
              disabled={added || atMax}
              onClick={() => onItemsChange(addOnboardingItem(items, s.name))}
              className={cn(
                'inline-flex h-11 items-center rounded-full border border-gray-300 px-4 text-sm font-semibold text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                'disabled:opacity-50'
              )}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      {atMax && (
        <p className="text-sm text-gray-600">
          You can add up to {MAX_ONBOARDING_ITEMS} items now. Add more later from Pantry.
        </p>
      )}
      {items.length > 0 && (
        <ul aria-label="Added items" className="flex flex-wrap gap-2">
          {items.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-full border border-primary-500 bg-primary-50 pl-4 text-sm font-semibold text-primary-700"
            >
              <span className="break-words">{name}</span>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onItemsChange(removeOnboardingItem(items, name))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
