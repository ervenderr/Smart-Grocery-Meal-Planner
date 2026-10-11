/**
 * Per-session coordination of /entitlements/verify calls (REVIEW-2 WR-02).
 *
 * - At most one verify per transactionId is in flight. The launch recheck and
 *   a Transaction.updates delivery for the same unfinished transaction share
 *   one request instead of sending two with different idempotency keys.
 * - A transaction the server reported as claimed by another account is
 *   remembered for the session, so StoreKit re-deliveries do not send a 409
 *   /verify on every launch or resume.
 */
export interface VerifyGate {
  /** Runs `fn`, or joins the verify already in flight for this transaction. */
  run<T>(transactionId: string, fn: () => Promise<T>): Promise<T>;
  isClaimedElsewhere(transactionId: string): boolean;
  markClaimedElsewhere(transactionId: string): void;
  clearClaimedElsewhere(transactionId: string): void;
}

export function createVerifyGate(): VerifyGate {
  let inFlight: ReadonlyMap<string, Promise<unknown>> = new Map();
  let claimed: ReadonlySet<string> = new Set();

  const withoutInFlight = (id: string) => new Map([...inFlight].filter(([key]) => key !== id));

  return {
    run<T>(transactionId: string, fn: () => Promise<T>): Promise<T> {
      const existing = inFlight.get(transactionId);
      if (existing) return existing as Promise<T>;
      // fn starts on a microtask, so the entry is registered before it can settle.
      const started: Promise<T> = Promise.resolve()
        .then(fn)
        .finally(() => {
          if (inFlight.get(transactionId) === started) inFlight = withoutInFlight(transactionId);
        });
      inFlight = new Map([...inFlight, [transactionId, started]]);
      return started;
    },
    isClaimedElsewhere: (transactionId) => claimed.has(transactionId),
    markClaimedElsewhere(transactionId) {
      claimed = new Set([...claimed, transactionId]);
    },
    clearClaimedElsewhere(transactionId) {
      if (!claimed.has(transactionId)) return;
      claimed = new Set([...claimed].filter((id) => id !== transactionId));
    },
  };
}

let session: { userId: string | null; gate: VerifyGate } | null = null;

/**
 * One gate per signed-in account: a purchase claimed by another account may
 * belong to the next account that signs in, so a new user starts fresh.
 */
export function sessionVerifyGate(userId: string | null): VerifyGate {
  if (session === null || session.userId !== userId) {
    session = { userId, gate: createVerifyGate() };
  }
  return session.gate;
}
