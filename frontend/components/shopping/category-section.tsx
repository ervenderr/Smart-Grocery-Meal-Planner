'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface CategorySectionProps {
  id: string;
  label: string;
  uncheckedCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CategorySection({
  id,
  label,
  uncheckedCount,
  totalCount,
  expanded,
  onToggle,
  children,
}: CategorySectionProps) {
  const contentId = `shopping-section-${id}`;
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <h2 className="m-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <span className="text-base font-semibold text-gray-900">{label}</span>
          <span className="flex items-center gap-2 text-sm text-gray-600">
            {uncheckedCount} left
            <span className="sr-only">of {totalCount}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>
      </h2>
      {expanded && (
        <ul id={contentId} className="px-4">
          {children}
        </ul>
      )}
    </section>
  );
}
