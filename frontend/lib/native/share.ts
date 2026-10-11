import { groupItems, type GroupableItem } from '../shopping/grouping';
import { unitLabel } from '../shopping/vocab';

export interface ShareableItem extends GroupableItem {
  quantity: number;
  unit: string;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'error';
export type SharePayload = { title: string; text: string };

export interface ShareDeps {
  native: boolean;
  nativeShare: ((p: SharePayload) => Promise<void>) | null;
  canNativeShare: () => Promise<boolean>;
  webShare: ((p: SharePayload) => Promise<void>) | null;
  copy: ((text: string) => Promise<void>) | null;
}

export const SHARE_TITLE = 'Kitcha shopping list';
export const SHARE_EMPTY_TEXT = 'Nothing left to buy.';
export const SHARE_ERROR_COPY = "Couldn't open sharing. Try again.";
export const SHARE_COPIED_COPY = 'List copied';

/** "Liters (L)" -> "L"; plain labels pass through. */
function shortUnit(unit: string): string {
  const label = unitLabel(unit);
  const match = /\(([^)]+)\)\s*$/.exec(label);
  return match ? match[1] : label;
}

function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 100) / 100);
}

function formatLine(item: ShareableItem): string {
  const unit = shortUnit(item.unit);
  return `[ ] ${item.itemName} (${formatQuantity(item.quantity)}${unit ? ` ${unit}` : ''})`;
}

export function buildShareText(items: readonly ShareableItem[]): {
  title: typeof SHARE_TITLE;
  text: string;
  count: number;
} {
  const unchecked = items.filter((i) => !i.isChecked);
  if (unchecked.length === 0) return { title: SHARE_TITLE, text: SHARE_EMPTY_TEXT, count: 0 };
  const sections = groupItems(unchecked).map((g) =>
    [g.label, ...g.items.map(formatLine)].join('\n')
  );
  return { title: SHARE_TITLE, text: sections.join('\n\n'), count: unchecked.length };
}

function errorText(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: '', message: String(error ?? '') };
}

function isCancel(error: unknown): boolean {
  const { name, message } = errorText(error);
  return name === 'AbortError' || /cancel/i.test(message);
}

async function attempt(run: () => Promise<void>, success: ShareOutcome): Promise<ShareOutcome> {
  try {
    await run();
    return success;
  } catch (error) {
    if (isCancel(error)) return 'cancelled';
    console.error('Share failed:', errorText(error).message);
    return 'error';
  }
}

export async function shareList(payload: SharePayload, deps: ShareDeps): Promise<ShareOutcome> {
  const { nativeShare, webShare, copy } = deps;
  if (deps.native) {
    if (!nativeShare) return 'error';
    try {
      if (!(await deps.canNativeShare())) return 'error';
    } catch {
      return 'error';
    }
    return attempt(() => nativeShare(payload), 'shared');
  }
  if (webShare) return attempt(() => webShare(payload), 'shared');
  if (copy) return attempt(() => copy(payload.text), 'copied');
  return 'error';
}
