'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDebouncedCommitter } from './debounced-commit';

const DEBOUNCE_MS = 400;

/**
 * Local pending quantity for one item. Changes show instantly; a single commit
 * with the final value fires after 400 ms of quiet. Resets to the server value
 * when it changes and nothing is pending. A change still waiting on the timer
 * is flushed (not dropped) on unmount, and commits are sent in order.
 */
export function useDebouncedQuantity(
  serverValue: number,
  commit: (value: number) => Promise<void>
) {
  const [value, setValue] = useState(serverValue);
  const commitRef = useRef(commit);
  const serverRef = useRef(serverValue);
  const committer = useRef<ReturnType<typeof createDebouncedCommitter> | null>(null);

  useEffect(() => {
    commitRef.current = commit;
    serverRef.current = serverValue;
  });

  useEffect(() => {
    if (!committer.current?.hasPending()) setValue(serverValue);
  }, [serverValue]);

  useEffect(() => {
    const current = createDebouncedCommitter({
      delayMs: DEBOUNCE_MS,
      getCommit: () => commitRef.current,
      // Rollback or settle: fall back to whatever the server value is now.
      onSettled: () => setValue(serverRef.current),
    });
    committer.current = current;
    return () => {
      current.flush();
      committer.current = null;
    };
  }, []);

  const change = useCallback((next: number) => {
    setValue(next);
    committer.current?.change(next);
  }, []);

  return { value, change };
}
