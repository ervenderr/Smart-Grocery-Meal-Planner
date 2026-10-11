import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeUpgradeSheet, openUpgradeSheet, useUpgradeSheetStore } from './upgrade-sheet-store';

beforeEach(() => closeUpgradeSheet());

describe('upgrade sheet store', () => {
  it('is a no-op when not native', () => {
    openUpgradeSheet({}, () => false);
    expect(useUpgradeSheetStore.getState().open).toBe(false);
  });

  it('opens with the onUnlocked callback on native', () => {
    const cb = vi.fn();
    openUpgradeSheet({ onUnlocked: cb }, () => true);
    const s = useUpgradeSheetStore.getState();
    expect(s.open).toBe(true);
    expect(s.onUnlocked).toBe(cb);
  });

  it('close resets to a fresh initial state', () => {
    openUpgradeSheet({ onUnlocked: vi.fn() }, () => true);
    const before = useUpgradeSheetStore.getState();
    closeUpgradeSheet();
    const after = useUpgradeSheetStore.getState();
    expect(after).toEqual({ open: false, onUnlocked: null, returnFocus: null });
    expect(after).not.toBe(before);
  });
});
