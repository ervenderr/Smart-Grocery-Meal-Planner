import { describe, expect, it } from 'vitest';
import { selectPersisted } from './auth-persist';
import type { User } from '@/types/auth.types';

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const state = Object.freeze({ user, token: 'SECRET-TOKEN', isAuthenticated: true });

describe('selectPersisted', () => {
  it('web keeps user, token and isAuthenticated', () => {
    expect(selectPersisted(state, false)).toEqual({ user, token: 'SECRET-TOKEN', isAuthenticated: true });
  });

  it('native persists only the user', () => {
    expect(selectPersisted(state, true)).toEqual({ user });
  });

  it('native payload never contains the token string', () => {
    expect(JSON.stringify(selectPersisted(state, true))).not.toContain('SECRET-TOKEN');
  });

  it('does not mutate a frozen input', () => {
    expect(() => selectPersisted(state, true)).not.toThrow();
    expect(() => selectPersisted(state, false)).not.toThrow();
    expect(state.token).toBe('SECRET-TOKEN');
  });
});
