import { describe, expect, it } from 'vitest';
import { deriveIndicator } from './derive-indicator';

const z = { queued: 0, inFlight: 0, failed: 0, blocked: 0, pausedAuth: 0 };
const base = { connectivity: 'online' as const, draining: false, counts: z, justSynced: false };

describe('deriveIndicator', () => {
  it('attention wins over offline', () => {
    const v = deriveIndicator({ ...base, connectivity: 'offline', counts: { ...z, failed: 1 } });
    expect(v).toMatchObject({ state: 'attention', label: '1 need attention', visible: true, count: 1 });
  });
  it('syncing shows pending count including blocked and paused', () => {
    const v = deriveIndicator({ ...base, draining: true, counts: { ...z, queued: 1, blocked: 1 } });
    expect(v).toMatchObject({ state: 'syncing', label: 'Syncing 2' });
  });
  it('offline with nothing pending', () => {
    expect(deriveIndicator({ ...base, connectivity: 'offline' })).toMatchObject({ state: 'offline', label: 'Offline', visible: true });
  });
  it('offline with pending', () => {
    const v = deriveIndicator({ ...base, connectivity: 'offline', counts: { ...z, queued: 2, inFlight: 1 } });
    expect(v.label).toBe('Offline · 3 pending');
    expect(v.ariaLabel).toBe('Offline, 3 changes waiting to sync. Open pending changes');
  });
  it('pending while online and idle', () => {
    expect(deriveIndicator({ ...base, counts: { ...z, queued: 2 } })).toMatchObject({ state: 'pending', label: '2 pending' });
  });
  it('just synced', () => {
    expect(deriveIndicator({ ...base, justSynced: true })).toMatchObject({ state: 'just-synced', label: 'All synced', visible: true });
  });
  it('synced is hidden', () => {
    expect(deriveIndicator(base)).toMatchObject({ state: 'synced', label: null, visible: false });
  });
  it('unknown connectivity is treated as online', () => {
    expect(deriveIndicator({ ...base, connectivity: 'unknown' }).state).toBe('synced');
  });
  it('aria uses singular for one change', () => {
    expect(deriveIndicator({ ...base, counts: { ...z, queued: 1 } }).ariaLabel).toBe('1 change waiting to sync. Open pending changes');
    expect(deriveIndicator({ ...base, counts: { ...z, failed: 1 } }).ariaLabel).toContain('1 change needs attention');
    expect(deriveIndicator({ ...base, draining: true, counts: { ...z, queued: 1 } }).ariaLabel).toContain('Syncing 1 change.');
  });
  it('offline aria with zero pending', () => {
    expect(deriveIndicator({ ...base, connectivity: 'offline' }).ariaLabel).toBe('Offline. Open pending changes');
  });
});
