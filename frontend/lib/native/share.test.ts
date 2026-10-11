import { describe, expect, it, vi } from 'vitest';
import { buildShareText, shareList, SHARE_ERROR_COPY, SHARE_COPIED_COPY, type ShareDeps, type ShareableItem } from './share';

function item(over: Partial<ShareableItem>): ShareableItem {
  return {
    id: over.itemName ?? 'i',
    itemName: 'Milk',
    category: 'dairy',
    isChecked: false,
    createdAt: '2026-01-01T00:00:00Z',
    quantity: 1,
    unit: 'liters',
    ...over,
  };
}

describe('buildShareText', () => {
  it('includes only unchecked items under category headers', () => {
    const r = buildShareText([
      item({ itemName: 'Milk', quantity: 2, unit: 'liters' }),
      item({ itemName: 'Eggs', isChecked: true }),
      item({ itemName: 'Rice', category: 'pantry', quantity: 1.5, unit: 'kg' }),
    ]);
    expect(r.title).toBe('Kitcha shopping list');
    expect(r.count).toBe(2);
    expect(r.text).toContain('[ ] Milk (2 L)');
    expect(r.text).toContain('[ ] Rice (1.5 kg)');
    expect(r.text).not.toContain('Eggs');
  });

  it('emits one header per non-empty category', () => {
    const r = buildShareText([item({ itemName: 'A' }), item({ itemName: 'B' })]);
    const lines = r.text.split('\n');
    expect(lines.filter((l) => !l.startsWith('[ ]') && l.trim() !== '')).toHaveLength(1);
  });

  it('handles empty and all-checked lists', () => {
    expect(buildShareText([])).toMatchObject({ count: 0, text: 'Nothing left to buy.' });
    expect(buildShareText([item({ isChecked: true })])).toMatchObject({ count: 0, text: 'Nothing left to buy.' });
  });

  it('does not mutate input', () => {
    const items = [item({ itemName: 'B' }), item({ itemName: 'A' })];
    const copy = JSON.parse(JSON.stringify(items));
    buildShareText(items);
    expect(items).toEqual(copy);
  });
});

const payload = { title: 't', text: 'x' };
function deps(over: Partial<ShareDeps>): ShareDeps {
  return { native: false, nativeShare: null, canNativeShare: async () => true, webShare: null, copy: null, ...over };
}

describe('shareList', () => {
  it('shares natively', async () => {
    expect(await shareList(payload, deps({ native: true, nativeShare: vi.fn().mockResolvedValue(undefined) }))).toBe('shared');
  });
  it('native cancel is cancelled', async () => {
    const nativeShare = vi.fn().mockRejectedValue(new Error('Share canceled'));
    expect(await shareList(payload, deps({ native: true, nativeShare }))).toBe('cancelled');
  });
  it('native cannot share is error', async () => {
    const nativeShare = vi.fn();
    expect(await shareList(payload, deps({ native: true, nativeShare, canNativeShare: async () => false }))).toBe('error');
  });
  it('native other rejection is error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const nativeShare = vi.fn().mockRejectedValue(new Error('boom'));
    expect(await shareList(payload, deps({ native: true, nativeShare }))).toBe('error');
    spy.mockRestore();
  });
  it('web share', async () => {
    expect(await shareList(payload, deps({ webShare: vi.fn().mockResolvedValue(undefined) }))).toBe('shared');
  });
  it('web AbortError is cancelled', async () => {
    const err = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(await shareList(payload, deps({ webShare: vi.fn().mockRejectedValue(err) }))).toBe('cancelled');
  });
  it('falls back to copy', async () => {
    expect(await shareList(payload, deps({ copy: vi.fn().mockResolvedValue(undefined) }))).toBe('copied');
  });
  it('copy rejection is error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await shareList(payload, deps({ copy: vi.fn().mockRejectedValue(new Error('x')) }))).toBe('error');
    spy.mockRestore();
  });
  it('nothing available is error', async () => {
    expect(await shareList(payload, deps({}))).toBe('error');
  });
  it('exposes copy strings', () => {
    expect(SHARE_ERROR_COPY).toBe("Couldn't open sharing. Try again.");
    expect(SHARE_COPIED_COPY).toBe('List copied');
  });
});
