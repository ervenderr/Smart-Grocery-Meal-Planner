import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiBadgeProps {
  className?: string;
}

export function AiBadge({ className }: AiBadgeProps) {
  return (
    <span
      aria-label="AI-generated content"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-sm font-semibold text-primary-700',
        className
      )}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      AI-generated
    </span>
  );
}
