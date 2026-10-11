import { create } from 'zustand';

export interface LogoutConfirmRequest {
  readonly title: string;
  readonly body: string;
}

interface LogoutConfirmStore {
  request: LogoutConfirmRequest | null;
  resolver: ((ok: boolean) => void) | null;
  ask: (request: LogoutConfirmRequest) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}

/** UI-only request/response state for the single logout confirmation modal. */
export const useLogoutConfirmStore = create<LogoutConfirmStore>((set, get) => ({
  request: null,
  resolver: null,
  ask: (request) =>
    new Promise<boolean>((resolve) => {
      get().resolver?.(false);
      set({ request, resolver: resolve });
    }),
  resolve: (ok) => {
    get().resolver?.(ok);
    set({ request: null, resolver: null });
  },
}));
