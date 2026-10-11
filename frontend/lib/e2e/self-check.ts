/** Pure helpers for the E2E-only self-check runner. */

export const E2E_LINE_PREFIX = 'KITCHA_E2E';
export const E2E_PHASE_KEY = 'kitcha:e2e-phase';

export type E2ePhase = 'login' | 'relaunch' | 'done';

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['token', 'refreshtoken', 'password', 'email']);

/** Builds a parseable log line; secret-bearing keys are dropped from data. */
export function formatE2eLine(step: string, data: Record<string, unknown>): string {
  const safe = Object.fromEntries(
    Object.entries(data).filter(([key]) => !FORBIDDEN_KEYS.has(key.toLowerCase()))
  );
  return `${E2E_LINE_PREFIX} ${JSON.stringify({ step, ...safe })}`;
}

/** Keys of storage entries whose value contains the token. */
export function findTokenLeaks(
  entries: readonly (readonly [string, string])[],
  token: string
): string[] {
  if (!token) return [];
  return entries.filter(([, value]) => value.includes(token)).map(([key]) => key);
}

export function nextPhase(current: string | null): E2ePhase {
  switch (current) {
    case 'login':
      return 'relaunch';
    case 'relaunch':
    case 'done':
      return 'done';
    default:
      return 'login';
  }
}
