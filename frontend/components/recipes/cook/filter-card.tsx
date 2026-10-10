import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { dietSummary } from '@/lib/rules/view-model';

interface FilterCardProps {
  readonly dietRestrictions: readonly string[];
  readonly prefsUnavailable?: boolean;
  readonly applyDiet: boolean;
  readonly onlyReady: boolean;
  readonly onToggleDiet: () => void;
  readonly onToggleReady: () => void;
}

function chipClass(active: boolean): string {
  return `h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
    active
      ? 'border-primary-500 bg-primary-50 text-primary-700'
      : 'border-gray-300 bg-white text-gray-700'
  }`;
}

export function FilterCard({
  dietRestrictions,
  prefsUnavailable = false,
  applyDiet,
  onlyReady,
  onToggleDiet,
  onToggleReady,
}: FilterCardProps) {
  const summary = dietSummary(dietRestrictions);

  return (
    <Card className="space-y-2 p-4">
      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
        {dietRestrictions.length > 0 && (
          <button
            type="button"
            aria-pressed={applyDiet}
            onClick={onToggleDiet}
            className={chipClass(applyDiet)}
          >
            Hide recipes with excluded ingredients
          </button>
        )}
        <button
          type="button"
          aria-pressed={onlyReady}
          onClick={onToggleReady}
          className={chipClass(onlyReady)}
        >
          Only recipes I can make now
        </button>
      </div>
      {prefsUnavailable && (
        <p role="alert" className="text-sm font-medium text-amber-800">
          We could not load your dietary preferences, so diet filtering is off. Recipes shown may
          contain ingredients you avoid. Connect to the internet and reopen this page to apply them.
        </p>
      )}
      {summary !== null && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-gray-600">
          <span>{summary}</span>
          <Link
            href="/profile"
            className="text-primary-700 inline-flex min-h-[44px] items-center font-semibold"
          >
            Change in profile
          </Link>
        </p>
      )}
    </Card>
  );
}
