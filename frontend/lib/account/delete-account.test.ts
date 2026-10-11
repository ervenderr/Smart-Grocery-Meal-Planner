import { describe, expect, it } from 'vitest';
import { consumeSessionEndIntent } from '@/lib/offline/session/session-hooks';
import {
  canSubmitDelete,
  classifyDeleteError,
  DELETE_ACCOUNT_MESSAGES,
  DELETED_LOGIN_PATH,
  markAccountDeleted,
} from './delete-account';

const httpError = (status: number, code?: string) => ({
  response: { status, data: code ? { code } : {} },
});

describe('classifyDeleteError', () => {
  it('maps 403 INVALID_PASSWORD to wrong_password', () => {
    expect(classifyDeleteError(httpError(403, 'INVALID_PASSWORD'))).toBe('wrong_password');
  });

  it('maps 429 to rate_limited', () => {
    expect(classifyDeleteError(httpError(429, 'ACCOUNT_DELETE_RATE_LIMITED'))).toBe('rate_limited');
  });

  it('maps 400 and 500 to failed', () => {
    expect(classifyDeleteError(httpError(400))).toBe('failed');
    expect(classifyDeleteError(httpError(500))).toBe('failed');
  });

  it('maps network errors (no response) to failed', () => {
    expect(classifyDeleteError(new Error('Network Error'))).toBe('failed');
    expect(classifyDeleteError(undefined)).toBe('failed');
  });

  it('maps 403 with another code to failed', () => {
    expect(classifyDeleteError(httpError(403, 'SOMETHING_ELSE'))).toBe('failed');
    expect(classifyDeleteError(httpError(403))).toBe('failed');
  });
});

describe('DELETE_ACCOUNT_MESSAGES', () => {
  it('has the specified copy', () => {
    expect(DELETE_ACCOUNT_MESSAGES.wrong_password).toBe('That password is incorrect. Try again.');
    expect(DELETE_ACCOUNT_MESSAGES.failed).toBe(
      "We couldn't delete your account. Check your connection and try again."
    );
    expect(DELETE_ACCOUNT_MESSAGES.rate_limited.length).toBeGreaterThan(0);
  });
});

describe('canSubmitDelete', () => {
  it('rejects empty and whitespace-only passwords', () => {
    expect(canSubmitDelete('')).toBe(false);
    expect(canSubmitDelete('   ')).toBe(false);
  });

  it('accepts a non-empty password', () => {
    expect(canSubmitDelete('x')).toBe(true);
  });
});

describe('DELETED_LOGIN_PATH', () => {
  it('points at the login page with the deleted flag', () => {
    expect(DELETED_LOGIN_PATH).toBe('/login?deleted=1');
  });
});

describe('markAccountDeleted', () => {
  it('sets the deleted session end intent', () => {
    markAccountDeleted();
    expect(consumeSessionEndIntent()).toBe('deleted');
  });
});
