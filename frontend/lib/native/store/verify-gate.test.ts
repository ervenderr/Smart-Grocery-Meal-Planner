import { describe, expect, it } from 'vitest';
import { createVerifyGate, sessionVerifyGate } from './verify-gate';

const deferred = <T,>() => {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createVerifyGate (REVIEW-2 WR-02)', () => {
  it('joins a run already in flight for the same transaction', async () => {
    const gate = createVerifyGate();
    const d = deferred<string>();
    let calls = 0;
    const fn = () => {
      calls += 1;
      return d.promise;
    };
    const a = gate.run('1', fn);
    const b = gate.run('1', fn);
    d.resolve('ok');
    expect(await Promise.all([a, b])).toEqual(['ok', 'ok']);
    expect(calls).toBe(1);
  });

  it('runs different transactions independently', async () => {
    const gate = createVerifyGate();
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return calls;
    };
    await Promise.all([gate.run('1', fn), gate.run('2', fn)]);
    expect(calls).toBe(2);
  });

  it('runs again once the previous run settled, including after a rejection', async () => {
    const gate = createVerifyGate();
    let calls = 0;
    await expect(
      gate.run('1', async () => {
        calls += 1;
        throw new Error('x');
      })
    ).rejects.toThrow('x');
    await gate.run('1', async () => {
      calls += 1;
    });
    expect(calls).toBe(2);
  });

  it('a synchronous throw from fn does not leave a stale entry', async () => {
    const gate = createVerifyGate();
    const boom = (): Promise<number> => {
      throw new Error('sync');
    };
    await expect(gate.run('1', boom)).rejects.toThrow('sync');
    expect(await gate.run('1', async () => 2)).toBe(2);
  });

  it('remembers and clears claimed-elsewhere transactions', () => {
    const gate = createVerifyGate();
    expect(gate.isClaimedElsewhere('1')).toBe(false);
    gate.markClaimedElsewhere('1');
    expect(gate.isClaimedElsewhere('1')).toBe(true);
    expect(gate.isClaimedElsewhere('2')).toBe(false);
    gate.clearClaimedElsewhere('1');
    expect(gate.isClaimedElsewhere('1')).toBe(false);
  });
});

describe('sessionVerifyGate', () => {
  it('returns the same gate for the same account and a fresh one for a new account', () => {
    const a = sessionVerifyGate('user-a');
    expect(sessionVerifyGate('user-a')).toBe(a);
    a.markClaimedElsewhere('9');
    const b = sessionVerifyGate('user-b');
    expect(b).not.toBe(a);
    expect(b.isClaimedElsewhere('9')).toBe(false);
  });
});
