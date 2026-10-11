export const LOGOUT_PENDING_COPY = {
  title: 'Log out?',
  stay: 'Stay signed in',
  confirm: 'Log out',
} as const;

export type LogoutDecision =
  | { confirm: false }
  | { confirm: true; title: string; body: string };

/** Decides whether logging out needs a warning about changes that have not synced. */
export function logoutDecision(pendingCount: number): LogoutDecision {
  if (!Number.isFinite(pendingCount) || pendingCount < 1) return { confirm: false };
  const n = Math.floor(pendingCount);
  const body =
    n === 1
      ? "1 change hasn't synced yet. It'll sync the next time you sign in to this account on this device."
      : `${n} changes haven't synced yet. They'll sync the next time you sign in to this account on this device.`;
  return { confirm: true, title: LOGOUT_PENDING_COPY.title, body };
}
