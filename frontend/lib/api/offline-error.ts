/** Thrown by apiClient when the offline gate is closed (native only). */
export class OfflineError extends Error {
  constructor(message = 'offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export function isOfflineError(e: unknown): boolean {
  return e instanceof OfflineError || (e instanceof Error && e.name === 'OfflineError');
}

let gate: (() => boolean) | null = null;

/** Registers a predicate returning true when requests must fail fast. Null clears it. */
export function registerOfflineGate(fn: (() => boolean) | null): void {
  gate = fn;
}

export function isOfflineGateClosed(): boolean {
  return gate !== null && gate();
}
