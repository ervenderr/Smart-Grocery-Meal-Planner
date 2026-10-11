import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_PANTRY_LIMIT, UPGRADE_REQUIRED_CODE, isUpgradeRequired, upgradeLimitFrom } from './upgrade-error';

const err = (status: number, data: unknown) => ({ response: { status, data } });

describe('isUpgradeRequired', () => {
  it('true for 403 UPGRADE_REQUIRED', () => {
    expect(isUpgradeRequired(err(403, { code: UPGRADE_REQUIRED_CODE, limit: 25 }))).toBe(true);
  });
  it('false for other codes or statuses', () => {
    expect(isUpgradeRequired(err(403, { code: 'OTHER' }))).toBe(false);
    expect(isUpgradeRequired(err(400, { code: UPGRADE_REQUIRED_CODE }))).toBe(false);
  });
  it('false for non-errors', () => {
    expect(isUpgradeRequired(null)).toBe(false);
    expect(isUpgradeRequired(undefined)).toBe(false);
    expect(isUpgradeRequired(new Error('x'))).toBe(false);
    expect(isUpgradeRequired({ response: null })).toBe(false);
  });
});

describe('upgradeLimitFrom', () => {
  it('reads a positive integer limit', () => {
    expect(upgradeLimitFrom(err(403, { limit: 40 }))).toBe(40);
  });
  it('falls back to the default', () => {
    for (const limit of ['25', -1, 0, NaN, 2.5, undefined]) {
      expect(upgradeLimitFrom(err(403, { limit }))).toBe(DEFAULT_FREE_PANTRY_LIMIT);
    }
    expect(upgradeLimitFrom(null)).toBe(25);
  });
});
