import { describe, expect, it } from 'vitest';
import { planUserTransition, type TransitionAction } from './user-scope';
import type { SessionEndIntent } from './session-hooks';

const out = (intent: SessionEndIntent, metaUserId: string | null = 'A') =>
  planUserTransition({ prevUserId: 'A', nextUserId: null, metaUserId, intent });
const types = (a: TransitionAction[]) => a.map((x) => x.type);

describe('planUserTransition', () => {
  it('expired keeps the cache and parks the ops', () => {
    expect(out('expired')).toEqual([{ type: 'pause-user-ops', userId: 'A' }]);
  });

  it('logout pauses ops, wipes the cache and clears the meta user', () => {
    expect(out('logout')).toEqual([
      { type: 'pause-user-ops', userId: 'A' },
      { type: 'wipe-cache' },
      { type: 'set-meta-user', userId: null },
    ]);
  });

  it('deleted removes that user ops and wipes the cache', () => {
    expect(out('deleted')).toEqual([
      { type: 'delete-user-ops', userId: 'A' },
      { type: 'wipe-cache' },
      { type: 'set-meta-user', userId: null },
    ]);
  });

  it('never emits delete-user-ops except for deleted', () => {
    const all: SessionEndIntent[] = ['expired', 'logout', 'deleted'];
    for (const intent of all) {
      const hasDelete = types(out(intent)).includes('delete-user-ops');
      expect(hasDelete).toBe(intent === 'deleted');
    }
    for (const meta of [null, 'A', 'B']) {
      const plan = planUserTransition({ prevUserId: null, nextUserId: 'A', metaUserId: meta, intent: 'expired' });
      expect(types(plan)).not.toContain('delete-user-ops');
    }
  });

  it('sign-out with no previous user is a no-op', () => {
    expect(planUserTransition({ prevUserId: null, nextUserId: null, metaUserId: 'A', intent: 'logout' })).toEqual([]);
  });

  it('same user signing in hydrates, resumes and refreshes', () => {
    const plan = planUserTransition({ prevUserId: null, nextUserId: 'A', metaUserId: 'A', intent: 'expired' });
    expect(plan).toEqual([{ type: 'hydrate' }, { type: 'resume-user-ops', userId: 'A' }, { type: 'refresh' }]);
  });

  it('first sign-in with no meta user records the user without wiping', () => {
    const plan = planUserTransition({ prevUserId: null, nextUserId: 'A', metaUserId: null, intent: 'expired' });
    expect(plan).toEqual([
      { type: 'set-meta-user', userId: 'A' },
      { type: 'resume-user-ops', userId: 'A' },
      { type: 'refresh' },
    ]);
  });

  it('a different user wipes the cache and leaves the old user ops alone', () => {
    const plan = planUserTransition({ prevUserId: null, nextUserId: 'B', metaUserId: 'A', intent: 'expired' });
    expect(plan).toEqual([
      { type: 'wipe-cache' },
      { type: 'set-meta-user', userId: 'B' },
      { type: 'resume-user-ops', userId: 'B' },
      { type: 'refresh' },
    ]);
    expect(types(plan)).not.toContain('pause-user-ops');
  });
});
