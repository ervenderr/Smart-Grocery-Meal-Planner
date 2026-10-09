'use client';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  id?: string;
  disabled?: boolean;
}

/** Accessible toggle: a native button, so Space and Enter toggle it. */
export function Switch({
  checked,
  onCheckedChange,
  labelledBy,
  describedBy,
  id,
  disabled = false,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary-500' : 'bg-gray-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
