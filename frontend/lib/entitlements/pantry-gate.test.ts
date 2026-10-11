import { describe, expect, it } from 'vitest';
import { decidePantryAdd, type PantryAddInput } from './pantry-gate';

const base: PantryAddInput = {
  native: true,
  online: true,
  entitlementStatus: 'none',
  pantryLimit: 25,
  activeCount: 25,
};

describe('decidePantryAdd', () => {
  it('opens the upgrade sheet on native at the limit', () => {
    expect(decidePantryAdd(base)).toBe('upgrade');
  });

  it('proceeds below the limit', () => {
    expect(decidePantryAdd({ ...base, activeCount: 24 })).toBe('proceed');
  });

  it('shows the web limit message on web at the limit', () => {
    expect(decidePantryAdd({ ...base, native: false })).toBe('web-limit');
  });

  it('proceeds for active entitlement regardless of count', () => {
    expect(decidePantryAdd({ ...base, entitlementStatus: 'active', activeCount: 500 })).toBe('proceed');
  });

  it('proceeds when the limit is null', () => {
    expect(decidePantryAdd({ ...base, pantryLimit: null })).toBe('proceed');
  });

  it('proceeds when the limit is unknown', () => {
    expect(decidePantryAdd({ ...base, pantryLimit: undefined })).toBe('proceed');
  });

  it('proceeds offline so the add queues', () => {
    expect(decidePantryAdd({ ...base, online: false })).toBe('proceed');
  });

  it('proceeds when the entitlement has not loaded', () => {
    expect(decidePantryAdd({ ...base, entitlementStatus: undefined })).toBe('proceed');
  });

  it('proceeds when the count is unknown', () => {
    expect(decidePantryAdd({ ...base, activeCount: undefined })).toBe('proceed');
  });

  it('treats revoked like none', () => {
    expect(decidePantryAdd({ ...base, entitlementStatus: 'revoked' })).toBe('upgrade');
    expect(decidePantryAdd({ ...base, entitlementStatus: 'revoked', native: false })).toBe('web-limit');
  });

  it('gates above the limit too', () => {
    expect(decidePantryAdd({ ...base, activeCount: 30 })).toBe('upgrade');
  });
});
