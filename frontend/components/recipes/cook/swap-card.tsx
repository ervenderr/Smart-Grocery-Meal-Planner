import type { SuggestedSwap } from '@/lib/rules';

interface SwapCardProps {
  readonly swap: SuggestedSwap;
}

export function SwapCard({ swap }: SwapCardProps) {
  return (
    <li className="space-y-2 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-gray-900">{swap.name}</span>
        {swap.inPantry && (
          <span className="rounded-full bg-green-100 px-2 py-1 text-sm font-semibold text-green-800">
            In your pantry
          </span>
        )}
      </div>
      <p className="text-base text-gray-900">{swap.ratioLine}</p>
      {swap.note !== '' && <p className="text-sm text-gray-600">{swap.note}</p>}
      {swap.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {swap.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-1 text-sm font-semibold text-gray-700"
            >
              {tag.replace(/_/g, '-')}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
