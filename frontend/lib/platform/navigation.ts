import { isNative } from '@/lib/platform/native';

export interface NavigateOptions {
  replace?: boolean;
}

export type NavigatorFn = (path: string, opts: NavigateOptions) => void;

interface NavigationDeps {
  isNative: () => boolean;
  hardNavigate: (path: string) => void;
}

/**
 * Navigation seam. Native uses the registered client-side router (the WebView
 * serves the root index.html for any reload, so hard navigation is unsafe);
 * web and the no-router fallback use a hard navigation.
 */
export function createNavigation(deps: NavigationDeps) {
  let current: NavigatorFn | null = null;

  return {
    register(fn: NavigatorFn): () => void {
      current = fn;
      return () => {
        if (current === fn) current = null;
      };
    },
    navigate(path: string, opts: NavigateOptions = {}): void {
      if (deps.isNative() && current) {
        current(path, opts);
        return;
      }
      deps.hardNavigate(path);
    },
  };
}

const appNavigation = createNavigation({
  isNative: () => isNative(),
  hardNavigate: (path) => {
    if (typeof window !== 'undefined') window.location.href = path;
  },
});

export const registerNavigator = appNavigation.register;
export const navigate = appNavigation.navigate;
