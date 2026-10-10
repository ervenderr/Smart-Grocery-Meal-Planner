interface CoverageBarProps {
  readonly percent: number;
  readonly label: string;
}

export function CoverageBar({ percent, label }: CoverageBarProps) {
  const safe = Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0;
  const fill = safe >= 100 ? 'bg-green-600' : 'bg-primary-500';
  return (
    <div
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
    >
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${safe}%` }} />
    </div>
  );
}
