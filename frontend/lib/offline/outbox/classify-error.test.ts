import { describe, expect, it } from 'vitest';
import { classify, MAX_TRANSIENT_ATTEMPTS, type TransportFailure } from './classify-error';
import type { OpKind } from './op-types';

const f = (p: Partial<TransportFailure>): TransportFailure => ({ network: false, timeout: false, ...p });
const c = (p: Partial<TransportFailure>, kind: OpKind = 'pantry.adjust', attempts = 0) => classify(f(p), { kind, attempts });

describe('classify', () => {
  it('network -> retry not counted', () => {
    expect(c({ network: true })).toEqual({ kind: 'retry', countsAttempt: false });
  });
  it('timeout -> retry not counted', () => {
    expect(c({ timeout: true })).toEqual({ kind: 'retry', countsAttempt: false });
  });
  it('network never parks even at high attempts', () => {
    expect(c({ network: true }, 'pantry.adjust', 99).kind).toBe('retry');
  });
  it('503 -> retry counted', () => {
    expect(c({ status: 503 })).toEqual({ kind: 'retry', countsAttempt: true });
  });
  it('503 at attempts 7 -> park max-attempts', () => {
    expect(MAX_TRANSIENT_ATTEMPTS).toBe(8);
    expect(c({ status: 503 }, 'pantry.adjust', 7)).toEqual({ kind: 'park', error: { reason: 'max-attempts', status: 503 } });
  });
  it('429 keeps retryAfterMs', () => {
    expect(c({ status: 429, retryAfterMs: 5000 })).toEqual({ kind: 'retry', countsAttempt: true, retryAfterMs: 5000 });
  });
  it('409 IN_FLIGHT -> retry', () => {
    const o = c({ status: 409, code: 'IDEMPOTENCY_IN_FLIGHT', retryAfterMs: 1000 });
    expect(o.kind).toBe('retry');
  });
  it('409 ALREADY_COOKED -> park conflict', () => {
    expect(c({ status: 409, code: 'ALREADY_COOKED' }, 'cook.apply')).toEqual({
      kind: 'park',
      error: { reason: 'conflict', status: 409, code: 'ALREADY_COOKED' },
    });
  });
  it('other 409 -> park conflict', () => {
    expect(c({ status: 409 })).toMatchObject({ kind: 'park', error: { reason: 'conflict' } });
  });
  it('404 on delete -> ok', () => {
    expect(c({ status: 404 }, 'shopping.item.delete')).toEqual({ kind: 'ok' });
    expect(c({ status: 404 }, 'pantry.delete')).toEqual({ kind: 'ok' });
  });
  it('404 on adjust -> park gone', () => {
    expect(c({ status: 404 })).toEqual({ kind: 'park', error: { reason: 'gone', status: 404 } });
  });
  it('410 -> park gone', () => {
    expect(c({ status: 410 })).toMatchObject({ kind: 'park', error: { reason: 'gone' } });
  });
  it('400 and 422 -> park invalid', () => {
    expect(c({ status: 400, code: 'VALIDATION_ERROR' })).toMatchObject({ kind: 'park', error: { reason: 'invalid', code: 'VALIDATION_ERROR' } });
    expect(c({ status: 422 })).toMatchObject({ kind: 'park', error: { reason: 'invalid' } });
  });
  it('422 KEY_REUSED -> park invalid with code', () => {
    expect(c({ status: 422, code: 'IDEMPOTENCY_KEY_REUSED' })).toEqual({
      kind: 'park',
      error: { reason: 'invalid', status: 422, code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });
  it('401 -> pause-auth', () => {
    expect(c({ status: 401 })).toEqual({ kind: 'pause-auth' });
  });
  it('401 while the session is still active -> counted retry, parks at max attempts (CR-03)', () => {
    expect(classify(f({ status: 401 }), { kind: 'pantry.adjust', attempts: 0, sessionActive: true })).toEqual({ kind: 'retry', countsAttempt: true });
    expect(classify(f({ status: 401 }), { kind: 'pantry.adjust', attempts: 7, sessionActive: true })).toEqual({
      kind: 'park',
      error: { reason: 'max-attempts', status: 401 },
    });
  });
  it('unknown 4xx -> park invalid; unknown no status -> retry counted', () => {
    expect(c({ status: 403 })).toMatchObject({ kind: 'park', error: { reason: 'invalid' } });
    expect(c({})).toEqual({ kind: 'retry', countsAttempt: true });
  });
});
