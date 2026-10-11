/** Pure phase machine for the offline E2E suite (E2E builds only). */

export const OFFLINE_PHASE_KEY = 'kitcha:e2e-offline-phase';

/** Launch 1 runs `seed` (+ offline-write); launch 2 runs `offline-cold-start` (+ reconnect + replay). */
export const OFFLINE_PHASES = ['seed', 'offline-cold-start', 'done'] as const;
export type OfflinePhase = (typeof OFFLINE_PHASES)[number];

/** Returns the phase to run on the NEXT launch, given the phase that just ran (null = nothing yet). */
export function nextOfflinePhase(current: string | null): OfflinePhase {
  switch (current) {
    case 'seed':
      return 'offline-cold-start';
    case 'offline-cold-start':
    case 'done':
      return 'done';
    default:
      return 'seed';
  }
}

/** Phase to run on this launch from the stored value (garbage or missing means a first launch). */
export function currentOfflinePhase(stored: string | null): OfflinePhase {
  return stored === 'offline-cold-start' || stored === 'done' ? stored : 'seed';
}
