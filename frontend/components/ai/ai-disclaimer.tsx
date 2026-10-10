import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISCLAIMER_TEXT =
  "AI suggestions may be inaccurate. Check ingredients for allergies and don't treat this as medical or nutrition advice.";

interface AiDisclaimerProps {
  className?: string;
}

export function AiDisclaimer({ className }: AiDisclaimerProps) {
  return (
    <div className={cn('flex gap-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-700', className)}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{DISCLAIMER_TEXT}</p>
    </div>
  );
}
