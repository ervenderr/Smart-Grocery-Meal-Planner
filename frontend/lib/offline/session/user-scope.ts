import type { SessionEndIntent } from './session-hooks';

export type { SessionEndIntent };

export type TransitionAction =
  | { type: 'wipe-cache' }
  | { type: 'delete-user-ops'; userId: string }
  | { type: 'pause-user-ops'; userId: string }
  | { type: 'set-meta-user'; userId: string | null }
  | { type: 'hydrate' }
  | { type: 'resume-user-ops'; userId: string }
  | { type: 'refresh' };

export interface TransitionInput {
  prevUserId: string | null;
  nextUserId: string | null;
  /** User id the on-disk cache was written for (cache_meta), null when unknown. */
  metaUserId: string | null;
  intent: SessionEndIntent;
}

/** Pure plan for a session change; delete-user-ops is emitted only for account deletion. */
export function planUserTransition({ prevUserId, nextUserId, metaUserId, intent }: TransitionInput): TransitionAction[] {
  if (nextUserId === null) {
    if (prevUserId === null) return [];
    if (intent === 'deleted') {
      return [
        { type: 'delete-user-ops', userId: prevUserId },
        { type: 'wipe-cache' },
        { type: 'set-meta-user', userId: null },
      ];
    }
    if (intent === 'logout') {
      return [{ type: 'pause-user-ops', userId: prevUserId }, { type: 'wipe-cache' }, { type: 'set-meta-user', userId: null }];
    }
    return [{ type: 'pause-user-ops', userId: prevUserId }];
  }
  const signIn: TransitionAction[] = [
    { type: 'resume-user-ops', userId: nextUserId },
    { type: 'refresh' },
  ];
  if (metaUserId === nextUserId) return [{ type: 'hydrate' }, ...signIn];
  if (metaUserId === null) return [{ type: 'set-meta-user', userId: nextUserId }, ...signIn];
  return [{ type: 'wipe-cache' }, { type: 'set-meta-user', userId: nextUserId }, ...signIn];
}
