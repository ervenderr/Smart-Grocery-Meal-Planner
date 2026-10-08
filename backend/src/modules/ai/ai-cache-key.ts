/**
 * Versioned, canonical cache key. userId is never part of the key: cached
 * payloads are model output only and are shared between users.
 */

import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') return value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => ({ ...acc, [k]: canonicalize(source[k]) }), {});
  }
  return value;
}

export function buildCacheKey(feature: string, schemaVersion: number, inputs: unknown): string {
  const serialized = JSON.stringify({ feature, v: schemaVersion, inputs: canonicalize(inputs) });
  return createHash('sha256').update(serialized).digest('hex');
}
