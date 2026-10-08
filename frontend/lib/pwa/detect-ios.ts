export interface NavigatorLike {
  readonly userAgent: string;
  readonly platform?: string;
  readonly maxTouchPoints?: number;
}

const IOS_UA = /iPhone|iPad|iPod/;
const NON_SAFARI_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|MicroMessenger/;

/** True only for Safari proper on iOS/iPadOS (not Chrome/Firefox/in-app browsers). */
export function isIosSafari(nav: NavigatorLike): boolean {
  const isIpadOsDesktopMode = nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
  const isIos = IOS_UA.test(nav.userAgent) || isIpadOsDesktopMode;
  return isIos && !NON_SAFARI_IOS.test(nav.userAgent);
}

export function isStandalone(input: {
  navigatorStandalone?: boolean;
  displayModeStandalone: boolean;
}): boolean {
  return input.navigatorStandalone === true || input.displayModeStandalone;
}
