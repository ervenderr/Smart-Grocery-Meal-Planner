import { ChefHat } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/common/skeleton';
import type { CookStatus } from '@/lib/rules/cook-data';

export function CookListSkeleton() {
  return (
    <div role="status" aria-label="Loading recipes" aria-busy="true" className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="space-y-3 p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-2 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

interface EmptyCopy {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
}

const COPY: Partial<Record<CookStatus, EmptyCopy>> = {
  emptyPantry: {
    title: 'Your pantry is empty',
    description: 'Add what you have and we will show the recipes you can cook.',
    actionLabel: 'Add pantry items',
  },
  noRecipes: {
    title: 'No recipes to rank yet',
    description: 'Save a recipe and it will be ranked against your pantry.',
    actionLabel: 'Add a recipe',
  },
  filteredOut: {
    title: 'Nothing matches your filters',
    description: 'Turn off "Only recipes I can make now" or change your diet in your profile.',
    actionLabel: 'Clear filters',
  },
  noOfflineData: {
    title: 'Nothing saved on this device yet',
    description: 'Connect once so Kumaun can save your pantry and recipes for offline use.',
  },
  error: {
    title: "Couldn't work out what you can cook.",
    description:
      'Close this page and open it again. If it keeps happening, check for an app update.',
    actionLabel: 'Try again',
  },
};

interface CookEmptyStateProps {
  readonly status: CookStatus;
  readonly onAction?: () => void;
}

export function CookEmptyState({ status, onAction }: CookEmptyStateProps) {
  const copy = COPY[status];
  if (!copy) return null;
  return (
    <EmptyState
      icon={ChefHat}
      title={copy.title}
      description={copy.description}
      actionLabel={onAction ? copy.actionLabel : undefined}
      onAction={onAction}
    />
  );
}
