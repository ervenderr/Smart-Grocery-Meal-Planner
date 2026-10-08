'use client';

import { Sun } from 'lucide-react';

interface ShoppingModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  wakeLockActive: boolean;
}

export function ShoppingModeToggle({ enabled, onChange, wakeLockActive }: ShoppingModeToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className="flex min-h-11 items-center gap-2 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
            enabled ? 'bg-primary-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
        <span className="text-base font-semibold text-gray-900">Shopping mode</span>
      </button>
      <span aria-live="polite" className="text-sm text-gray-600">
        {wakeLockActive && (
          <span className="flex items-center gap-1">
            <Sun className="h-4 w-4" aria-hidden="true" />
            Screen stays on
          </span>
        )}
      </span>
    </div>
  );
}
