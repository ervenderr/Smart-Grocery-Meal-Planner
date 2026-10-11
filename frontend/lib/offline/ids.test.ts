import { describe, expect, it } from 'vitest';
import { newId, UUID_V4_RE } from './ids';

const fillBytes = (a: Uint8Array): Uint8Array => {
  for (let i = 0; i < a.length; i += 1) a[i] = Math.floor(Math.random() * 256);
  return a;
};

describe('newId', () => {
  it('uses randomUUID when present', () => {
    const id = newId({ randomUUID: () => 'fixed-id', getRandomValues: fillBytes });
    expect(id).toBe('fixed-id');
  });

  it('falls back to getRandomValues and yields a v4 uuid', () => {
    const id = newId({ randomUUID: undefined, getRandomValues: fillBytes });
    expect(id).toMatch(UUID_V4_RE);
    expect(id[14]).toBe('4');
    expect('89ab').toContain(id[19]);
  });

  it('sets version and variant bits even for all-ones bytes', () => {
    const id = newId({ getRandomValues: (a) => a.fill(255) });
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('sets version and variant bits even for all-zero bytes', () => {
    const id = newId({ getRandomValues: (a) => a.fill(0) });
    expect(id).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('generates 1000 unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId({ getRandomValues: fillBytes })));
    expect(ids.size).toBe(1000);
  });

  it('works with the default global crypto', () => {
    expect(newId()).toMatch(UUID_V4_RE);
  });
});
