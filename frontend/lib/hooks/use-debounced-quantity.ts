'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 400;

/**
 * Local pending quantity for one item. Changes show instantly; a single commit
 * with the final value fires after 400 ms of quiet. Resets to the server value
 * when it changes and nothing is pending.
 */
export function useDebouncedQuantity(
  serverValue: number,
  commit: (value: number) => Promise<void>
) {
  const [value, setValue] = useState(serverValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number | null>(null);
  const commitRef = useRef(commit);
  const serverRef = useRef(serverValue);

  useEffect(() => {
    commitRef.current = commit;
    serverRef.current = serverValue;
  });

  useEffect(() => {
    if (pending.current === null) setValue(serverValue);
  }, [serverValue]);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  const change = useCallback(
    (next: number) => {
      setValue(next);
      pending.current = next;
      clear();
      timer.current = setTimeout(() => {
        const final = pending.current;
        timer.current = null;
        if (final === null) return;
        commitRef
          .current(final)
          .catch(() => undefined)
          .finally(() => {
            if (pending.current === final) {
              pending.current = null;
              // Rollback or settle: fall back to whatever the server value is now.
              setValue(serverRef.current);
            }
          });
      }, DEBOUNCE_MS);
    },
    []
  );

  return { value, change };
}
