import { describe, expect, it } from 'vitest';
import { shouldDismissKeyboard } from './keyboard-dismiss';

describe('shouldDismissKeyboard', () => {
  it('is false when keyboard is closed', () => {
    expect(shouldDismissKeyboard({ tagName: 'DIV', closestInteractive: false }, false)).toBe(false);
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT', 'input'])('is false for %s', (tagName) => {
    expect(shouldDismissKeyboard({ tagName, closestInteractive: false }, true)).toBe(false);
  });

  it('is false for contenteditable', () => {
    expect(
      shouldDismissKeyboard({ tagName: 'DIV', isContentEditable: true, closestInteractive: false }, true)
    ).toBe(false);
  });

  it('is false when inside an interactive element', () => {
    expect(shouldDismissKeyboard({ tagName: 'SPAN', closestInteractive: true }, true)).toBe(false);
  });

  it.each(['DIV', 'MAIN'])('is true for non-interactive %s with keyboard open', (tagName) => {
    expect(shouldDismissKeyboard({ tagName, closestInteractive: false }, true)).toBe(true);
  });
});
