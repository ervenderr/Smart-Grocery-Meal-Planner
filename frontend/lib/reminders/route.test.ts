import { describe, expect, it } from 'vitest';
import { parseNotificationRoute } from './route';

describe('parseNotificationRoute', () => {
  it('accepts the allowlisted route', () => {
    expect(parseNotificationRoute({ route: '/pantry/?filter=expiring' })).toBe('/pantry/?filter=expiring');
  });
  it.each([
    { route: 'https://evil.example' },
    { route: '/settings' },
    { route: '//evil.example' },
    { route: 5 },
    {},
    null,
    undefined,
    'x',
  ])('rejects %j', (extra) => {
    expect(parseNotificationRoute(extra)).toBeNull();
  });
});
