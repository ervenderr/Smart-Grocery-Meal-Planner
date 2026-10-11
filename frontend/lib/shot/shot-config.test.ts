import { describe, expect, it } from 'vitest';
import { parseShotConfig } from './shot-config';

const base = { email: 'a@b.co', password: 'pw', route: '/pantry/' };

describe('parseShotConfig', () => {
  it('accepts a minimal valid config and defaults the delay', () => {
    expect(parseShotConfig(base)).toEqual({ ...base, click: null, delayMs: 2500 });
  });
  it('accepts a query string route and a click text', () => {
    const c = parseShotConfig({ ...base, route: '/pantry/?filter=expiring', click: ' Chicken ', delayMs: '900' });
    expect(c).toMatchObject({ route: '/pantry/?filter=expiring', click: 'Chicken', delayMs: 900 });
  });
  it('rejects missing credentials, absolute urls and non-objects', () => {
    expect(parseShotConfig(null)).toBeNull();
    expect(parseShotConfig('x')).toBeNull();
    expect(parseShotConfig({ ...base, password: '' })).toBeNull();
    expect(parseShotConfig({ ...base, route: 'https://evil.example/' })).toBeNull();
    expect(parseShotConfig({ ...base, route: '//evil.example' })).toBeNull();
  });
  it('rejects an oversized click text and caps the delay', () => {
    expect(parseShotConfig({ ...base, click: 'x'.repeat(81) })).toBeNull();
    expect(parseShotConfig({ ...base, delayMs: 999999 })?.delayMs).toBe(20000);
  });
});
