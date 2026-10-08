/** Viewport shrink (px) that we treat as an on-screen keyboard. */
export const KEYBOARD_HEIGHT_THRESHOLD_PX = 120;

export interface KeyboardOpenInput {
  /** A connected text-entry element currently has focus. */
  readonly textEntryFocused: boolean;
  /** visualViewport height, or null when the API is unavailable. */
  readonly viewportHeight: number | null;
  /** Viewport height measured while no text field was focused. */
  readonly baselineHeight: number;
}

/**
 * Pure decision: keyboard counts as open only when a text field is focused
 * AND the viewport is actually shrunk (iOS keeps focus after "Done", so focus
 * alone is not enough). Without visualViewport we fall back to focus alone.
 */
export function computeKeyboardOpen({
  textEntryFocused,
  viewportHeight,
  baselineHeight,
}: KeyboardOpenInput): boolean {
  if (!textEntryFocused) return false;
  if (viewportHeight === null) return true;
  return baselineHeight - viewportHeight > KEYBOARD_HEIGHT_THRESHOLD_PX;
}
