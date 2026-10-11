import type { QueryClient } from '@tanstack/react-query';
import { isOfflineError, registerOfflineGate } from '@/lib/api/offline-error';
import { readCacheMeta } from './cache/cache-meta';
import { isOfflineEnabled } from './enabled';
import { applyUserTransition } from './session/apply-transition';
import { planUserTransition, type TransitionAction } from './session/user-scope';
import { setOfflineRuntime, type OfflineRuntime } from './runtime';
import { migrate } from './sql/migrations';
import type { SqlDb } from './sql/types';

export const BOOT_TIMEOUT_MS = 1500;

export type BootResult =
  | { status: 'disabled' }
  | { status: 'no-user' }
  | { status: 'ready'; restored: number }
  | { status: 'empty-offline' }
  | { status: 'failed-open'; reason: string };

export interface BootArgs {
  queryClient: QueryClient;
  getDb: () => Promise<SqlDb | null>;
  getUserId: () => string | null;
  waitForAuth: () => Promise<unknown>;
  createRuntime: (db: SqlDb) => OfflineRuntime;
  timeoutMs?: number;
  enabled?: () => boolean;
}

/** Boot applies the sign-in plan minus refresh (the gate refreshes) and always hydrates unless wiping. */
async function applyBootPlan(
  runtime: OfflineRuntime,
  qc: QueryClient,
  db: SqlDb,
  plan: TransitionAction[],
): Promise<number> {
  const wiped = plan.some((a) => a.type === 'wipe-cache');
  const actions = plan.filter((a) => a.type !== 'refresh');
  if (!wiped && !actions.some((a) => a.type === 'hydrate')) actions.unshift({ type: 'hydrate' });
  return applyUserTransition(runtime, qc, db, actions);
}

async function runBoot(args: BootArgs): Promise<BootResult> {
  await args.waitForAuth();
  const db = await args.getDb();
  if (!db) return { status: 'failed-open', reason: 'db-unavailable' };
  await migrate(db);
  const runtime = args.createRuntime(db);
  await runtime.store.resetInFlight();
  setOfflineRuntime(runtime);
  registerOfflineGate(() => runtime.connectivity.getState() === 'offline');
  args.queryClient.setDefaultOptions({
    ...args.queryClient.getDefaultOptions(),
    queries: {
      ...args.queryClient.getDefaultOptions().queries,
      networkMode: 'offlineFirst',
      retry: (n: number, e: unknown) => !isOfflineError(e) && n < 1,
    },
  });
  // Started even without a user so a later sign-in is persisted (writes are skipped until then)
  runtime.persister.start();
  const userId = args.getUserId();
  if (!userId) return { status: 'no-user' };
  const meta = await readCacheMeta(db);
  const plan = planUserTransition({ prevUserId: null, nextUserId: userId, metaUserId: meta.userId, intent: 'expired' });
  const restored = await applyBootPlan(runtime, args.queryClient, db, plan);
  if (restored === 0 && !(await runtime.connectivity.isReachable())) {
    return { status: 'empty-offline' };
  }
  return { status: 'ready', restored };
}

/** Opens, migrates and hydrates the offline cache before first render; fails open at the timeout. */
export async function bootOffline(args: BootArgs): Promise<BootResult> {
  if (!(args.enabled ?? isOfflineEnabled)()) return { status: 'disabled' };
  const timeoutMs = args.timeoutMs ?? BOOT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<BootResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'failed-open', reason: 'timeout' }), timeoutMs);
  });
  const work = runBoot(args).catch((error: unknown): BootResult => {
    console.error('Offline boot failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'failed-open', reason: 'error' };
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
