import type { FoodAttribution } from '@/lib/api/food';

interface FoodDataAttributionProps {
  attribution: FoodAttribution;
  className?: string;
}

export function FoodDataAttribution({ attribution, className }: FoodDataAttributionProps) {
  return (
    <div className={`text-xs text-gray-500 ${className ?? ''}`.trim()}>
      <p>
        Data:{' '}
        <a
          href={attribution.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          {attribution.name}
        </a>{' '}
        ({attribution.license})
      </p>
      {attribution.note && <p>{attribution.note}</p>}
    </div>
  );
}
