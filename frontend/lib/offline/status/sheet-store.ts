import { create } from 'zustand';

interface PendingSheetStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const usePendingSheet = create<PendingSheetStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export const openPendingSheet = (): void => usePendingSheet.getState().setOpen(true);
