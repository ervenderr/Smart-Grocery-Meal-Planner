export interface TargetInfo {
  tagName: string;
  isContentEditable?: boolean;
  closestInteractive: boolean;
}

const TEXT_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when a tap on non-interactive background should dismiss the open keyboard. */
export function shouldDismissKeyboard(info: TargetInfo, keyboardOpen: boolean): boolean {
  if (!keyboardOpen) return false;
  if (TEXT_TAGS.has(info.tagName.toUpperCase())) return false;
  if (info.isContentEditable) return false;
  return !info.closestInteractive;
}
