import { canonicalJson, computeRequestHash } from '../src/modules/idempotency/idempotency.hash';
import { idempotencyKeySchema } from '../src/modules/idempotency/idempotency.constants';

describe('canonicalJson', () => {
  it('is independent of key order, recursively', () => {
    const a = { b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } };
    const b = { a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('preserves array order', () => {
    expect(canonicalJson(['a', 'b'])).not.toBe(canonicalJson(['b', 'a']));
  });

  it('is stable for undefined and empty object', () => {
    expect(canonicalJson(undefined)).toBe(canonicalJson(undefined));
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson(undefined)).not.toBe(canonicalJson({}));
  });

  it('distinguishes numbers from numeric strings', () => {
    expect(canonicalJson(1)).not.toBe(canonicalJson('1'));
  });

  it('does not mutate its input', () => {
    const input = { b: 1, a: 2 };
    canonicalJson(input);
    expect(Object.keys(input)).toEqual(['b', 'a']);
  });
});

describe('computeRequestHash', () => {
  it('returns 64 hex chars and varies by method, route and body', () => {
    const base = computeRequestHash('POST', '/api/v1/pantry', { a: 1 });
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(computeRequestHash('post', '/api/v1/pantry', { a: 1 })).toBe(base);
    expect(computeRequestHash('PATCH', '/api/v1/pantry', { a: 1 })).not.toBe(base);
    expect(computeRequestHash('POST', '/api/v1/other', { a: 1 })).not.toBe(base);
    expect(computeRequestHash('POST', '/api/v1/pantry', { a: 2 })).not.toBe(base);
  });
});

describe('idempotencyKeySchema', () => {
  it.each(['a1b2c3d4-e5f6-4789-a012-b3c4d5e6f708', 'abc.DEF_123:x-y', '12345678'])(
    'accepts %s',
    (k) => expect(idempotencyKeySchema.safeParse(k).success).toBe(true)
  );

  it.each(['1234567', 'a'.repeat(256), 'has space1', 'with/slash1', ''])(
    'rejects %j',
    (k) => expect(idempotencyKeySchema.safeParse(k).success).toBe(false)
  );
});

describe('computeRequestHash query (WR-01)', () => {
  const { computeRequestHash } = jest.requireActual('../src/modules/idempotency/idempotency.hash');
  it('differs when the query differs', () => {
    expect(computeRequestHash('POST', '/x', {}, { a: '1' })).not.toBe(
      computeRequestHash('POST', '/x', {}, { a: '2' })
    );
  });
  it('is order-insensitive and unchanged for an empty query', () => {
    expect(computeRequestHash('POST', '/x', {}, { a: '1', b: '2' })).toBe(
      computeRequestHash('POST', '/x', {}, { b: '2', a: '1' })
    );
    expect(computeRequestHash('POST', '/x', { k: 1 }, {})).toBe(
      computeRequestHash('POST', '/x', { k: 1 })
    );
  });
});
