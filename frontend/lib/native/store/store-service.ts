import type { EntitlementStatus, VerifyResult } from '../../api/entitlements';
import { getApiErrorCode } from '../../api/errors';
import { isOfflineError } from '../../api/offline-error';
import {
  IAP_PRODUCT_ID,
  type KumaunStorePlugin,
  type StoreProduct,
  type StoreTransaction,
} from './store-plugin';

export interface StoreDeps {
  plugin: KumaunStorePlugin;
  verify(jws: string, idempotencyKey: string): Promise<VerifyResult>;
  newKey(): string;
  isOnline(): boolean;
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

/** Verifies with the server; finishes the device transaction only after a 2xx. */
async function verifyAndFinish(
  deps: StoreDeps,
  tx: StoreTransaction,
  key: string
): Promise<VerifyKind> {
  if (!deps.isOnline()) return 'transient';
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

/** Launch/resume re-check. Never prompts for Apple ID (no AppStore sync), and skipped when the server already says active. */
export async function recheckEntitlements(
  deps: StoreDeps,
  serverStatus: EntitlementStatus
): Promise<'verified' | 'skipped' | 'pending' | 'failed'> {
  if (serverStatus === 'active') return 'skipped';
  let txs: StoreTransaction[];
  try {
    txs = await readEntitlements(deps);
  } catch {
    return 'failed';
  }
  if (txs.length === 0) return 'skipped';
  const results = await verifyAll(deps, txs);
  if (results.some((r) => r === 'active' || r === 'revoked')) return 'verified';
  return results.includes('transient') ? 'pending' : 'failed';
}
