import type { QueryClient } from '@tanstack/react-query';
import { isOfflineError, registerOfflineGate } from '@/lib/api/offline-error';
import { COOK_PANTRY_KEY, COOK_RECIPES_KEY } from '@/lib/hooks/use-cook-from-pantry';
import {
  MEAL_PLANS_ALL_KEY,
  PANTRY_ALL_KEY,
  RECIPES_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
} from './cache/cache-keys';
import { isOfflineEnabled } from './enabled';
import { reapplyForKey } from './reconcile/reapply';
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

const CANONICAL_KEYS: ReadonlyArray<readonly unknown[]> = [
  PANTRY_ALL_KEY,
  COOK_PANTRY_KEY,
  RECIPES_ALL_KEY,
  COOK_RECIPES_KEY,
  MEAL_PLANS_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
];

async function foldPendingOps(runtime: OfflineRuntime, qc: QueryClient, userId: string): Promise<void> {
  const ops = await runtime.store.list(userId);
  if (ops.length === 0) return;
  for (const key of CANONICAL_KEYS) {
    const data = qc.getQueryData(key as unknown[]);
    if (data === undefined) continue;
    qc.setQueryData(key as unknown[], reapplyForKey(key, data, ops));
  }
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
  const userId = args.getUserId();
  if (!userId) return { status: 'no-user' };
  const { restored } = await runtime.persister.hydrateAll();
  await foldPendingOps(runtime, args.queryClient, userId);
  runtime.persister.start();
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
