'use client';

import { useId, type ReactNode } from 'react';
import { useIsOnline } from '@/lib/offline/status/use-offline-status';

export const NEEDS_CONNECTION_COPY = 'Needs a connection';

interface NeedsConnectionProps {
  /** Render the control; `disabled` is true while offline, `describedById` links the helper line. */
  children: (disabled: boolean, describedById: string | undefined) => ReactNode;
  /** Keep the helper on the same line as the control instead of below it. */
  inline?: boolean;
}

/**
 * Online-only actions stay visible but disabled offline, with a helper line
 * (UI-SPEC section 2). On web useIsOnline() is always true, so nothing changes.
 */
export function NeedsConnection({ children, inline = false }: NeedsConnectionProps) {
  const online = useIsOnline();
  const helperId = useId();
  const disabled = !online;

  if (!disabled) return <>{children(false, undefined)}</>;

  return (
    <div className={inline ? 'inline-flex items-center gap-2' : 'flex flex-col items-start gap-1'}>
      {children(true, helperId)}
      <span id={helperId} className="text-xs text-gray-600">
        {NEEDS_CONNECTION_COPY}
      </span>
    </div>
  );
}
