const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'file',
  'color',
  'image',
  'hidden',
]);

interface TextEntryCandidate {
  readonly tagName?: string;
  readonly type?: string;
}

/**
 * True when focusing the element opens the on-screen keyboard
 * (used to hide the bottom nav while typing).
 */
export function isTextEntry(el: TextEntryCandidate | null | undefined): boolean {
  if (!el || typeof el.tagName !== 'string') return false;

  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;

  const type = (el.type ?? 'text').toLowerCase();
  return !NON_TEXT_INPUT_TYPES.has(type);
}
