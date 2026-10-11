import { create } from 'zustand';
import { isNative } from '@/lib/platform/native';

export interface UpgradeSheetState {
  open: boolean;
  onUnlocked: (() => void) | null;
  returnFocus: HTMLElement | null;
}

const INITIAL: UpgradeSheetState = { open: false, onUnlocked: null, returnFocus: null };

/** UI-only state for the single shared upgrade sheet. Not persisted. */
export const useUpgradeSheetStore = create<UpgradeSheetState>(() => ({ ...INITIAL }));

export interface OpenOptions {
  onUnlocked?: () => void;
  returnFocus?: HTMLElement | null;
}

/** Opens the sheet on user-initiated limit hits; a no-op unless running in the native shell. */
export function openUpgradeSheet(
  opts: OpenOptions = {},
  nativeCheck: () => boolean = isNative
): void {
  if (!nativeCheck()) return;
  useUpgradeSheetStore.setState({
    open: true,
    onUnlocked: opts.onUnlocked ?? null,
    returnFocus: opts.returnFocus ?? null,
  });
}

export function closeUpgradeSheet(): void {
  useUpgradeSheetStore.setState({ ...INITIAL }, true);
}
