import { randomUUID } from 'crypto';
import { decodeCursor, encodeCursor } from '../src/modules/sync/sync.cursor';
import { bootstrapQuerySchema } from '../src/modules/sync/sync.validation';
import { formatPantryItem } from '../src/modules/pantry/pantry.format';

const b64 = (v: unknown): string =>
  Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

describe('sync cursor', () => {
  it('round trips', () => {
    const c = { s: 'recipes' as const, after: randomUUID() };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    const n = { s: 'mealPlans' as const, after: null };
    expect(decodeCursor(encodeCursor(n))).toEqual(n);
  });

  const bad: Array<[string, string]> = [
    ['non-base64url', 'not base64!!'],
    ['empty', ''],
    ['non-JSON', b64('hello')],
    ['unknown section', b64({ s: 'users', after: null })],
    ['non-uuid after', b64({ s: 'pantry', after: 'abc' })],
    ['missing after', b64({ s: 'pantry' })],
    ['extra keys', b64({ s: 'pantry', after: null, x: 1 })],
    ['too long', 'A'.repeat(513)],
  ];
  it.each(bad)('rejects %s', (_n, raw) => {
    expect(() => decodeCursor(raw)).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'SYNC_CURSOR_INVALID' })
    );
  });
});

describe('bootstrapQuerySchema', () => {
  it('defaults limit to 100', () => {
    expect(bootstrapQuerySchema.parse({}).limit).toBe(100);
  });
  it('accepts bounds and coerces strings', () => {
    expect(bootstrapQuerySchema.parse({ limit: '1' }).limit).toBe(1);
    expect(bootstrapQuerySchema.parse({ limit: '200' }).limit).toBe(200);
  });
  it.each(['0', '201', 'abc'])('rejects limit %s', (l) => {
    expect(bootstrapQuerySchema.safeParse({ limit: l }).success).toBe(false);
  });
});

describe('formatPantryItem', () => {
  it('formats a row', () => {
    const now = new Date('2026-01-02T03:04:05Z');
    const out = formatPantryItem({
      id: 'i', userId: 'u', ingredientName: 'Milk', quantity: { toString: () => '2' },
      unit: 'l', category: null, expiryDate: null, purchaseDate: null,
      purchasePriceCents: null, location: 'FRIDGE', notes: null, barcode: undefined,
      createdAt: now, updatedAt: now,
    } as never);
    expect(out).toMatchObject({ id: 'i', quantity: '2', barcode: null, isExpired: false, daysUntilExpiry: null });
  });
});
