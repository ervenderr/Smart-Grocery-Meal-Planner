import { describe, expect, it } from 'vitest';
import { relativeTimeAgo } from './relative-time';

const NOW = 1_700_000_000_000;

describe('relativeTimeAgo', () => {
  it('formats minutes, hours and days', () => {
    expect(relativeTimeAgo(NOW - 5_000, NOW)).toBe('just now');
    expect(relativeTimeAgo(NOW - 60_000, NOW)).toBe('1 minute ago');
    expect(relativeTimeAgo(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
    expect(relativeTimeAgo(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago');
    expect(relativeTimeAgo(NOW - 2 * 86_400_000, NOW)).toBe('2 days ago');
  });
  it('clamps future timestamps', () => {
    expect(relativeTimeAgo(NOW + 1000, NOW)).toBe('just now');
  });
});
