import { describe, expect, it } from 'vitest';
import { computeKeyboardOpen, KEYBOARD_HEIGHT_THRESHOLD_PX } from './keyboard-open';

describe('computeKeyboardOpen', () => {
  it('is closed when no text field is focused, whatever the viewport', () => {
    expect(
      computeKeyboardOpen({ textEntryFocused: false, viewportHeight: 300, baselineHeight: 800 })
    ).toBe(false);
  });

  it('is open when a text field is focused and the viewport shrank', () => {
    expect(
      computeKeyboardOpen({ textEntryFocused: true, viewportHeight: 450, baselineHeight: 800 })
    ).toBe(true);
  });

  it('is closed when focus stays (iOS Done) but the viewport is restored', () => {
    expect(
      computeKeyboardOpen({ textEntryFocused: true, viewportHeight: 800, baselineHeight: 800 })
    ).toBe(false);
  });

  it('ignores small shrinks such as browser chrome changes', () => {
    expect(
      computeKeyboardOpen({
        textEntryFocused: true,
        viewportHeight: 800 - KEYBOARD_HEIGHT_THRESHOLD_PX,
        baselineHeight: 800,
      })
    ).toBe(false);
  });

  it('falls back to focus alone without visualViewport', () => {
    expect(
      computeKeyboardOpen({ textEntryFocused: true, viewportHeight: null, baselineHeight: 800 })
    ).toBe(true);
  });
});
