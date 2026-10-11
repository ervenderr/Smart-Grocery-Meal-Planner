import { describe, expect, it } from 'vitest';
import { parseInverse } from './inverse';
import { makeOp, ID_A } from '../outbox/fixtures.test-helper';

const del = (inverse: unknown) => makeOp({ kind: 'pantry.delete', label: 'x', payload: { id: ID_A }, inverse });

describe('parseInverse', () => {
  it('accepts a valid inverse and rejects invalid ones', () => {
    expect(parseInverse(del({ item: { id: ID_A } }))).toEqual({ item: { id: ID_A } });
    expect(parseInverse(del(null))).toBeNull();
    expect(parseInverse(del({ nope: 1 }))).toBeNull();
  });
  it('parses empty inverse kinds', () => {
    expect(parseInverse(makeOp({ kind: 'pantry.adjust', label: 'x', payload: { id: ID_A, delta: 1 }, inverse: {} }))).toEqual({});
  });
});
