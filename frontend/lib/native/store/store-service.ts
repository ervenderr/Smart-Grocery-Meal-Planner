import type { EntitlementStatus, VerifyResult } from '../../api/entitlements';
import { getApiErrorCode } from '../../api/errors';
import { isOfflineError } from '../../api/offline-error';
import {
  IAP_PRODUCT_ID,
  TRANSACTION_UPDATED_EVENT,
  type KumaunStorePlugin,
  type StoreProduct,
  type StoreTransaction,
  type StoreTransactionUpdate,
} from './store-plugin';
import type { VerifyGate } from './verify-gate';

export interface StoreDeps {
  plugin: KumaunStorePlugin;
  verify(jws: string, idempotencyKey: string): Promise<VerifyResult>;
  newKey(): string;
  isOnline(): boolean;
  /** Session-wide verify dedupe and claimed-elsewhere memory (REVIEW-2 WR-02). */
  gate: VerifyGate;
}

export type PurchaseOutcome =
  | { kind: 'unlocked' }
  | { kind: 'revoked' }
  | { kind: 'cancelled' }
  | { kind: 'pending-approval' }
  | { kind: 'verify-pending' }
  | { kind: 'verify-failed' }
  | { kind: 'claimed-elsewhere' }
  | { kind: 'failed' };

export type RestoreOutcome =
  | { kind: 'restored' }
  | { kind: 'none' }
  | { kind: 'revoked' }
  | { kind: 'verify-pending' }
  | { kind: 'claimed-elsewhere' }
  | { kind: 'failed' };

type VerifyKind = 'active' | 'revoked' | 'transient' | 'claimed' | 'failed';

const PRODUCT = { productId: IAP_PRODUCT_ID } as const;

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

const IDEMPOTENCY_IN_FLIGHT = 'IDEMPOTENCY_IN_FLIGHT';
const RATE_LIMITED = 429;

/**
 * Rate limits (429) and an in-flight duplicate of the same Idempotency-Key
 * (409 IDEMPOTENCY_IN_FLIGHT) are retryable: the user was charged and the
 * unfinished transaction is re-verified on the next recheck (WR-03).
 */
function classifyVerifyError(error: unknown): VerifyKind {
  if (isOfflineError(error)) return 'transient';
  const status = httpStatus(error);
  if (status === undefined || status >= 500 || status === RATE_LIMITED) return 'transient';
  if (status === 409) {
    const code = getApiErrorCode(error);
    if (code === 'ENTITLEMENT_ALREADY_CLAIMED') return 'claimed';
    if (code === IDEMPOTENCY_IN_FLIGHT) return 'transient';
  }
  return 'failed';
}

/**
 * Verifies with the server; finishes the device transaction only after a 2xx.
 * Joins a verify already in flight for the same transaction (REVIEW-2 WR-02).
 */
async function verifyAndFinish(
  deps: StoreDeps,
  tx: StoreTransaction,
  key: string
): Promise<VerifyKind> {
  if (!deps.isOnline()) return 'transient';
  const kind = await deps.gate.run(tx.transactionId, () => verifyOnce(deps, tx, key));
  if (kind === 'claimed') deps.gate.markClaimedElsewhere(tx.transactionId);
  else if (kind === 'active' || kind === 'revoked') deps.gate.clearClaimedElsewhere(tx.transactionId);
  return kind;
}

async function verifyOnce(deps: StoreDeps, tx: StoreTransaction, key: string): Promise<VerifyKind> {
  let result: VerifyResult;
  try {
    result = await deps.verify(tx.jws, key);
  } catch (error) {
    return classifyVerifyError(error);
  }
  try {
    await deps.plugin.finish({ transactionId: tx.transactionId });
  } catch {
    // Server already accepted it; an unfinished transaction is re-verified idempotently on recheck.
  }
  return result.status === 'active' ? 'active' : 'revoked';
}

/** StoreKit transaction ids grow over time, so a numeric-aware descending sort is newest first. */
function newestFirst(txs: ReadonlyArray<StoreTransaction>): StoreTransaction[] {
  return [...txs].sort((a, b) =>
    a.transactionId.length !== b.transactionId.length
      ? b.transactionId.length - a.transactionId.length
      : b.transactionId.localeCompare(a.transactionId)
  );
}

/** One user action, one idempotency key; later transactions get a distinct suffix. */
async function verifyAll(
  deps: StoreDeps,
  txs: ReadonlyArray<StoreTransaction>
): Promise<VerifyKind[]> {
  const key = deps.newKey();
  const results: VerifyKind[] = [];
  for (const [i, tx] of newestFirst(txs).entries()) {
    results.push(await verifyAndFinish(deps, tx, i === 0 ? key : `${key}:${i}`));
  }
  return results;
}

export async function loadProduct(deps: StoreDeps): Promise<StoreProduct | null> {
  try {
    return await deps.plugin.getProduct(PRODUCT);
  } catch {
    return null;
  }
}

const PURCHASE_BY_VERIFY: Record<VerifyKind, PurchaseOutcome> = {
  active: { kind: 'unlocked' },
  revoked: { kind: 'revoked' },
  transient: { kind: 'verify-pending' },
  claimed: { kind: 'claimed-elsewhere' },
  failed: { kind: 'verify-failed' },
};

export async function purchaseFull(deps: StoreDeps): Promise<PurchaseOutcome> {
  let result;
  try {
    result = await deps.plugin.purchase(PRODUCT);
  } catch {
    return { kind: 'failed' };
  }
  if (result.status === 'cancelled') return { kind: 'cancelled' };
  if (result.status === 'pending') return { kind: 'pending-approval' };
  const [kind] = await verifyAll(deps, [result]);
  return PURCHASE_BY_VERIFY[kind];
}

const RESTORE_PRIORITY: ReadonlyArray<[VerifyKind, RestoreOutcome]> = [
  ['active', { kind: 'restored' }],
  ['transient', { kind: 'verify-pending' }],
  ['claimed', { kind: 'claimed-elsewhere' }],
  ['revoked', { kind: 'revoked' }],
];

function summarizeRestore(results: ReadonlyArray<VerifyKind>): RestoreOutcome {
  const hit = RESTORE_PRIORITY.find(([kind]) => results.includes(kind));
  return hit ? hit[1] : { kind: 'failed' };
}

async function readEntitlements(deps: StoreDeps): Promise<StoreTransaction[]> {
  const { transactions } = await deps.plugin.currentEntitlements(PRODUCT);
  return transactions;
}

export async function restorePurchases(deps: StoreDeps): Promise<RestoreOutcome> {
  try {
    let txs = await readEntitlements(deps);
    if (txs.length === 0) {
      await deps.plugin.sync();
      txs = await readEntitlements(deps);
    }
    if (txs.length === 0) return { kind: 'none' };
    return summarizeRestore(await verifyAll(deps, txs));
  } catch {
    return { kind: 'failed' };
  }
}

/** What /entitlements/me (loaded from the server) says this account holds. */
export interface ServerEntitlement {
  status: EntitlementStatus;
  /** Absent on servers that predate REVIEW-2 WR-03; then nothing is finished unverified. */
  originalTransactionId: string | null;
}

export type RecheckResult = 'verified' | 'skipped' | 'pending' | 'claimed-elsewhere' | 'failed';

async function finishQuietly(deps: StoreDeps, tx: StoreTransaction): Promise<void> {
  try {
    await deps.plugin.finish({ transactionId: tx.transactionId });
  } catch {
    // Best effort; StoreKit re-delivers it and the next recheck handles it again.
  }
}

/**
 * Server already says active (REVIEW-2 WR-03). Only the device transactions of
 * the purchase the server holds are finished locally. Every other unfinished
 * transaction is verified first, so an unrecorded purchase (for example a real
 * Production one while the account holds a Sandbox unlock) reaches the server
 * before StoreKit forgets it. verifyAndFinish finishes after a 2xx. A 409
 * claimed one is already recorded for another account, so it is finished too:
 * this account is already unlocked and nothing is lost.
 */
async function settleUnfinishedWhileActive(
  deps: StoreDeps,
  server: ServerEntitlement
): Promise<RecheckResult> {
  let txs: StoreTransaction[];
  try {
    ({ transactions: txs } = await deps.plugin.unfinishedTransactions(PRODUCT));
  } catch {
    return 'skipped';
  }
  const held = server.originalTransactionId;
  const isHeld = (tx: StoreTransaction) => held !== null && tx.originalTransactionId === held;
  for (const tx of txs.filter(isHeld)) await finishQuietly(deps, tx);
  const others = newestFirst(txs.filter((tx) => !isHeld(tx)));
  if (others.length === 0) return 'skipped';
  const results = await verifyAll(deps, others);
  for (const [i, tx] of others.entries()) {
    if (results[i] === 'claimed') await finishQuietly(deps, tx);
  }
  if (results.some((r) => r === 'active' || r === 'revoked')) return 'verified';
  return results.includes('transient') ? 'pending' : 'skipped';
}

/**
 * Launch/resume re-check. Never prompts for Apple ID (no AppStore sync). When the
 * server already says active, see settleUnfinishedWhileActive. Otherwise the
 * device's current entitlements are verified.
 */
export async function recheckEntitlements(
  deps: StoreDeps,
  server: ServerEntitlement
): Promise<RecheckResult> {
  if (server.status === 'active') return settleUnfinishedWhileActive(deps, server);
  let txs: StoreTransaction[];
  try {
    txs = await readEntitlements(deps);
  } catch {
    return 'failed';
  }
  if (txs.length === 0) return 'skipped';
  const results = await verifyAll(deps, txs);
  if (results.some((r) => r === 'active' || r === 'revoked')) return 'verified';
  if (results.includes('transient')) return 'pending';
  return results.includes('claimed') ? 'claimed-elsewhere' : 'failed';
}

export type UpdateResult = 'verified' | 'pending' | 'claimed-elsewhere' | 'failed' | 'ignored';

const UPDATE_BY_VERIFY: Record<VerifyKind, UpdateResult> = {
  active: 'verified',
  revoked: 'verified',
  transient: 'pending',
  claimed: 'claimed-elsewhere',
  failed: 'failed',
};

/**
 * Handles one Transaction.updates delivery: verify with the server, then finish
 * (verifyAndFinish only finishes after a 2xx). Other products are ignored, and so
 * is a re-delivery of a transaction already claimed by another account this
 * session: StoreKit re-sends it on every launch, and each verify would be
 * another 409 against the verify rate limit (REVIEW-2 WR-02).
 */
export async function handleTransactionUpdate(
  deps: StoreDeps,
  update: StoreTransactionUpdate
): Promise<UpdateResult> {
  if (update.productId !== IAP_PRODUCT_ID) return 'ignored';
  if (deps.gate.isClaimedElsewhere(update.transactionId)) return 'ignored';
  const tx: StoreTransaction = {
    jws: update.jws,
    originalTransactionId: update.originalTransactionId,
    transactionId: update.transactionId,
  };
  const [kind] = await verifyAll(deps, [tx]);
  return UPDATE_BY_VERIFY[kind];
}

/**
 * Subscribes to native transaction updates. Deliveries are handled one at a time,
 * and deps.gate shares an in-flight verify with the launch recheck, so the same
 * transaction is never verified twice at once. Returns an unsubscribe function.
 */
export async function subscribeTransactionUpdates(
  deps: StoreDeps,
  onResult: (result: UpdateResult) => void
): Promise<() => void> {
  let chain: Promise<void> = Promise.resolve();
  const handle = await deps.plugin.addListener(TRANSACTION_UPDATED_EVENT, (update) => {
    chain = chain.then(async () => {
      try {
        onResult(await handleTransactionUpdate(deps, update));
      } catch {
        onResult('failed');
      }
    });
  });
  return () => {
    void handle.remove();
  };
}
