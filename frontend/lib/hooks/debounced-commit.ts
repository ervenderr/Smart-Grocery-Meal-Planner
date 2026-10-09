/**
 * Framework-free debounced committer used by useDebouncedQuantity.
 *
 * - Changes coalesce: one commit with the final value after `delayMs` of quiet.
 * - Commits run strictly in order (a late response to an earlier write can never
 *   land after a newer one).
 * - `flush()` sends a still-waiting change immediately (used on unmount so an
 *   edit made just before navigating away is not dropped).
 */

export interface DebouncedCommitter {
  change: (next: number) => void;
  flush: () => void;
  readonly hasPending: () => boolean;
}

export function createDebouncedCommitter(args: {
  delayMs: number;
  getCommit: () => (value: number) => Promise<void>;
  /** Called after a commit settles (success or failure) with no newer change pending. */
  onSettled: () => void;
}): DebouncedCommitter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  const send = () => {
    const final = pending;
    timer = null;
    if (final === null) return;
    chain = chain
      .then(() => args.getCommit()(final))
      .catch(() => undefined)
      .finally(() => {
        if (pending === final) {
          pending = null;
          args.onSettled();
        }
      });
  };

  return {
    change(next) {
      pending = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(send, args.delayMs);
    },
    flush() {
      if (timer === null) return;
      clearTimeout(timer);
      send();
    },
    hasPending: () => pending !== null,
  };
}
