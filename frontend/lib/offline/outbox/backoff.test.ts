import { describe, expect, it } from 'vitest';
import { nextDelayMs } from './backoff';

describe('nextDelayMs', () => {
  it('attempts 0 within jitter band', () => {
    for (const r of [0, 0.5, 0.999]) {
      const d = nextDelayMs(0, { random: () => r });
      expect(d).toBeGreaterThanOrEqual(800);
      expect(d).toBeLessThanOrEqual(1200);
    }
  });
  it('caps at 36000', () => {
    expect(nextDelayMs(10, { random: () => 1 })).toBeLessThanOrEqual(36000);
    expect(nextDelayMs(50, { random: () => 1 })).toBeLessThanOrEqual(36000);
  });
  it('honours retryAfterMs', () => {
    expect(nextDelayMs(0, { random: () => 0, retryAfterMs: 5000 })).toBeGreaterThanOrEqual(5000);
  });
  it('grows exponentially', () => {
    expect(nextDelayMs(3, { random: () => 0.5 })).toBe(8000);
  });
});
