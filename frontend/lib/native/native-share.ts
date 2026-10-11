import { isNative, loadPlugin } from '../platform/native';
import {
  buildShareText,
  shareList,
  type ShareDeps,
  type ShareableItem,
  type ShareOutcome,
} from './share';

type SharePlugin = typeof import('@capacitor/share').Share;

function webDeps(): Pick<ShareDeps, 'webShare' | 'copy'> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const webShare =
    nav && typeof nav.share === 'function'
      ? (p: { title: string; text: string }) => nav.share(p)
      : null;
  const clipboard = nav?.clipboard;
  const copy =
    clipboard && typeof clipboard.writeText === 'function'
      ? (text: string) => clipboard.writeText(text)
      : null;
  return { webShare, copy };
}

export async function shareShoppingList(items: readonly ShareableItem[]): Promise<ShareOutcome> {
  const { title, text } = buildShareText(items);
  const native = isNative();
  let plugin: SharePlugin | null = null;
  if (native) {
    const mod = await loadPlugin(() => import('@capacitor/share'));
    plugin = mod?.Share ?? null;
  }
  const deps: ShareDeps = {
    native,
    nativeShare: plugin
      ? async (p) => {
          await plugin.share({ title: p.title, text: p.text, dialogTitle: p.title });
        }
      : null,
    canNativeShare: async () => (plugin ? (await plugin.canShare()).value : false),
    ...webDeps(),
  };
  return shareList({ title, text }, deps);
}
