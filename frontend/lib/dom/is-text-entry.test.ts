import { describe, expect, it } from 'vitest';
import { isTextEntry } from './is-text-entry';

describe('isTextEntry', () => {
  it('returns false for null, undefined and objects without tagName', () => {
    expect(isTextEntry(null)).toBe(false);
    expect(isTextEntry(undefined)).toBe(false);
    expect(isTextEntry({})).toBe(false);
  });

  it('returns true for TEXTAREA and SELECT in any case', () => {
    expect(isTextEntry({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntry({ tagName: 'textarea' })).toBe(true);
    expect(isTextEntry({ tagName: 'SELECT' })).toBe(true);
    expect(isTextEntry({ tagName: 'select' })).toBe(true);
  });

  it.each(['text', 'email', 'number', 'search', 'tel', 'password', 'url'])(
    'returns true for INPUT type %s',
    (type) => {
      expect(isTextEntry({ tagName: 'INPUT', type })).toBe(true);
    }
  );

  it('returns true for INPUT with missing type', () => {
    expect(isTextEntry({ tagName: 'INPUT' })).toBe(true);
    expect(isTextEntry({ tagName: 'input' })).toBe(true);
  });

  it.each([
    'checkbox',
    'radio',
    'button',
    'submit',
    'reset',
    'range',
    'file',
    'color',
    'image',
    'hidden',
  ])('returns false for INPUT type %s', (type) => {
    expect(isTextEntry({ tagName: 'INPUT', type })).toBe(false);
    expect(isTextEntry({ tagName: 'INPUT', type: type.toUpperCase() })).toBe(false);
  });

  it('returns false for DIV, BUTTON and A', () => {
    expect(isTextEntry({ tagName: 'DIV' })).toBe(false);
    expect(isTextEntry({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextEntry({ tagName: 'A' })).toBe(false);
  });
});
