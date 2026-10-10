/**
 * Canonical JSON serialisation and request hashing for idempotency.
 */

import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Recursively key-sorted JSON; builds new objects, never mutates the input. */
export function canonicalJson(value: unknown): string {
  const result = JSON.stringify(canonicalize(value));
  return result === undefined ? 'undefined' : result;
}

export function computeRequestHash(method: string, route: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method.toUpperCase()} ${route} ${canonicalJson(body)}`)
    .digest('hex');
}
