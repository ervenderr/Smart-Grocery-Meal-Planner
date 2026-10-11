import type { EntitlementStatus } from '@/lib/api/entitlements';
import type { RecheckResult } from '@/lib/native/store/store-service';

export type RecheckTrigger = 'mount' | 'resume' | 'online';
export type RecheckSkip = 'in-flight' | 'debounced' | 'stopped';

export interface RecheckControllerDeps {
  run(serverStatus: EntitlementStatus): Promise<RecheckResult>;
  now(): number;
  /** Minimum gap between resume/online rechecks. */
  minIntervalMs: number;
}

export interface RecheckController {
  trigger(reason: RecheckTrigger, serverStatus: EntitlementStatus): Promise<RecheckResult | RecheckSkip>;
}

export const RECHECK_MIN_INTERVAL_MS = 60_000;

/**
 * One launch/resume recheck owner per signed-in session (WR-07):
 * - never runs two at once;
 * - resume/online triggers within minIntervalMs of the last run are dropped;
 * - after a claimed-elsewhere result it stops for the session, since every
 *   further verify would be another 409 that burns the verify rate limit.
 * The caller only triggers once /entitlements/me has loaded from the server.
 */
export function createRecheckController(deps: RecheckControllerDeps): RecheckController {
  let running = false;
  let stopped = false;
  let lastRunAt: number | null = null;

  return {
    async trigger(reason, serverStatus) {
      if (stopped) return 'stopped';
      if (running) return 'in-flight';
      const now = deps.now();
      if (reason !== 'mount' && lastRunAt !== null && now - lastRunAt < deps.minIntervalMs) {
        return 'debounced';
      }
      running = true;
      lastRunAt = now;
      try {
        const result = await deps.run(serverStatus);
        if (result === 'claimed-elsewhere') stopped = true;
        return result;
      } catch {
        return 'failed';
      } finally {
        running = false;
      }
    },
  };
}
