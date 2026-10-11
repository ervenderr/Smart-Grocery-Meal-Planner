export const SPLASH_MAX_MS = 2000;

export interface SplashDeps {
  hide: () => Promise<void>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface SplashHider {
  firstPaint(): void;
  start(): void;
}

/** Hides the splash exactly once: on first paint or after SPLASH_MAX_MS, whichever comes first. */
export function createSplashHider(deps: SplashDeps): SplashHider {
  let done = false;
  let started = false;
  let handle: unknown = null;

  const finish = (): void => {
    if (done) return;
    done = true;
    if (handle !== null) deps.clearTimer(handle);
    deps
      .hide()
      .catch((error: unknown) =>
        console.error('Splash hide failed:', error instanceof Error ? error.message : 'unknown')
      );
  };

  return {
    start() {
      if (started || done) return;
      started = true;
      handle = deps.setTimer(finish, SPLASH_MAX_MS);
    },
    firstPaint: finish,
  };
}
