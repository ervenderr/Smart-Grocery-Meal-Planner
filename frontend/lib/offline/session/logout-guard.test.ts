import { describe, expect, it } from 'vitest';
import { LOGOUT_PENDING_COPY, logoutDecision } from './logout-guard';

describe('logoutDecision', () => {
  it('does not ask when nothing is pending', () => {
    expect(logoutDecision(0)).toEqual({ confirm: false });
  });

  it('uses singular copy for one change', () => {
    const d = logoutDecision(1);
    expect(d).toMatchObject({ confirm: true, title: 'Log out?' });
    if (d.confirm) expect(d.body).toBe("1 change hasn't synced yet. It'll sync the next time you sign in to this account on this device.");
  });

  it('uses plural copy with the count', () => {
    const d = logoutDecision(3);
    if (!d.confirm) throw new Error('expected confirm');
    expect(d.body).toBe("3 changes haven't synced yet. They'll sync the next time you sign in to this account on this device.");
  });

  it('treats negative or fractional input as nothing pending', () => {
    expect(logoutDecision(-2)).toEqual({ confirm: false });
    expect(logoutDecision(Number.NaN)).toEqual({ confirm: false });
  });

  it('avoids technical jargon', () => {
    const text = JSON.stringify([logoutDecision(2), LOGOUT_PENDING_COPY]).toLowerCase();
    for (const word of ['outbox', 'queue', 'sync engine']) expect(text).not.toContain(word);
  });
});
