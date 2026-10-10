import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CONSENT_REQUIRED_CODE,
  decideAiAction,
  isAiConsentRequiredError,
  toConsentState,
} from './consent-flow';
import { useAiConsentStore } from './consent-store';

const status = (consented: boolean) => ({
  consented,
  consentedAt: consented ? '2026-10-10T00:00:00Z' : null,
  version: consented ? 1 : null,
  currentVersion: 1,
});

const err = (statusCode: number, code?: string) => ({
  response: { status: statusCode, data: { code } },
});

describe('toConsentState', () => {
  it('is unknown while loading', () => {
    expect(toConsentState(undefined, true)).toBe('unknown');
  });
  it('is unknown with no data', () => {
    expect(toConsentState(undefined, false)).toBe('unknown');
  });
  it('is granted when consented', () => {
    expect(toConsentState(status(true), false)).toBe('granted');
  });
  it('is missing when not consented', () => {
    expect(toConsentState(status(false), false)).toBe('missing');
  });
});

describe('decideAiAction', () => {
  it('runs only when granted', () => {
    expect(decideAiAction('granted')).toBe('run');
    expect(decideAiAction('missing')).toBe('prompt');
    expect(decideAiAction('unknown')).toBe('prompt');
  });
});

describe('isAiConsentRequiredError', () => {
  it('matches 403 with the consent code', () => {
    expect(isAiConsentRequiredError(err(403, AI_CONSENT_REQUIRED_CODE))).toBe(true);
  });
  it('rejects other codes, statuses and non-objects', () => {
    expect(isAiConsentRequiredError(err(403, 'OTHER'))).toBe(false);
    expect(isAiConsentRequiredError(err(401, AI_CONSENT_REQUIRED_CODE))).toBe(false);
    expect(isAiConsentRequiredError('nope')).toBe(false);
    expect(isAiConsentRequiredError(null)).toBe(false);
  });
});

describe('useAiConsentStore', () => {
  beforeEach(() => useAiConsentStore.getState().reset());

  it('request opens and stores the action', () => {
    const action = vi.fn();
    useAiConsentStore.getState().request(action);
    const s = useAiConsentStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.pendingAction).toBe(action);
  });
  it('accept returns the action and resets', () => {
    const action = vi.fn();
    useAiConsentStore.getState().request(action);
    expect(useAiConsentStore.getState().accept()).toBe(action);
    expect(useAiConsentStore.getState().isOpen).toBe(false);
    expect(useAiConsentStore.getState().pendingAction).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
  it('dismiss closes without running', () => {
    const action = vi.fn();
    useAiConsentStore.getState().request(action);
    useAiConsentStore.getState().dismiss();
    expect(useAiConsentStore.getState().isOpen).toBe(false);
    expect(useAiConsentStore.getState().pendingAction).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
  it('keeps only the latest action', () => {
    const a = vi.fn();
    const b = vi.fn();
    useAiConsentStore.getState().request(a);
    useAiConsentStore.getState().request(b);
    expect(useAiConsentStore.getState().pendingAction).toBe(b);
  });
});
