import { create } from 'zustand';

type PendingAction = (() => void) | null;

interface AiConsentStore {
  isOpen: boolean;
  pendingAction: PendingAction;
  request: (action?: () => void) => void;
  accept: () => PendingAction;
  dismiss: () => void;
  reset: () => void;
}

const CLOSED = { isOpen: false, pendingAction: null } as const;

/** UI-only state for the single shared consent sheet. Intentionally not persisted. */
export const useAiConsentStore = create<AiConsentStore>((set, get) => ({
  ...CLOSED,
  request: (action) => set({ isOpen: true, pendingAction: action ?? null }),
  accept: () => {
    const { pendingAction } = get();
    set({ ...CLOSED });
    return pendingAction;
  },
  dismiss: () => set({ ...CLOSED }),
  reset: () => set({ ...CLOSED }),
}));
