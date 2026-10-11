import type { QueryClient } from '@tanstack/react-query';
import { COOK_PANTRY_KEY, COOK_RECIPES_KEY } from '@/lib/hooks/use-cook-from-pantry';
import {
  MEAL_PLANS_ALL_KEY,
  PANTRY_ALL_KEY,
  RECIPES_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
} from '../cache/cache-keys';
import { writeCacheMeta } from '../cache/cache-meta';
import type { OfflineRuntime } from '../runtime';
import { reapplyForKey } from '../reconcile/reapply';
import type { SqlDb } from '../sql/types';
import type { TransitionAction } from './user-scope';

export type TransitionRuntime = Pick<OfflineRuntime, 'store' | 'persister' | 'drain' | 'refreshFromServer'>;

const CANONICAL_KEYS: ReadonlyArray<readonly unknown[]> = [
  PANTRY_ALL_KEY,
  COOK_PANTRY_KEY,
  RECIPES_ALL_KEY,
  COOK_RECIPES_KEY,
  MEAL_PLANS_ALL_KEY,
  SHOPPING_ACTIVE_KEY,
];

/** Re-applies the user's pending ops over the canonical cached lists. */
export async function foldPendingOps(
  runtime: Pick<OfflineRuntime, 'store'>,
  qc: QueryClient,
  userId: string,
): Promise<void> {
  const ops = await runtime.store.list(userId);
  if (ops.length === 0) return;
  for (const key of CANONICAL_KEYS) {
    const data = qc.getQueryData(key as unknown[]);
    if (data === undefined) continue;
    qc.setQueryData(key as unknown[], reapplyForKey(key, data, ops));
  }
}

/**
 * Runs transition actions in order. The caller keeps the persister suspended around the
 * in-memory clear and resumes it after this resolves. Returns the rows restored by hydrate.
 */
export async function applyUserTransition(
  runtime: TransitionRuntime,
  queryClient: QueryClient,
  db: SqlDb,
  actions: readonly TransitionAction[],
): Promise<number> {
  let restored = 0;
  const signInUser = actions.find((a) => a.type === 'resume-user-ops');
  for (const action of actions) {
    switch (action.type) {
      case 'wipe-cache':
        queryClient.clear();
        await runtime.persister.wipe();
        break;
      case 'delete-user-ops':
        await runtime.store.deleteForUser(action.userId);
        break;
      case 'pause-user-ops':
        await runtime.store.pauseAuth(action.userId);
        break;
      case 'set-meta-user':
        if (action.userId === null) await db.run(`DELETE FROM cache_meta WHERE key = 'user_id'`);
        else await writeCacheMeta(db, { userId: action.userId });
        break;
      case 'hydrate':
        restored = (await runtime.persister.hydrateAll()).restored;
        if (signInUser?.type === 'resume-user-ops') await foldPendingOps(runtime, queryClient, signInUser.userId);
        break;
      case 'resume-user-ops':
        await runtime.store.resumeAuth(action.userId);
        runtime.drain.kick('login');
        break;
      case 'refresh':
        void runtime.refreshFromServer('login');
        break;
    }
  }
  return restored;
}
