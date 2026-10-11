/**
 * Store-screenshot build only (NEXT_PUBLIC_SHOT=1, Simulator only). The Simulator-only
 * Swift shim in mobile/ios/App/App/SceneDelegate.swift injects window.__KUMAUN_SHOT__ from the
 * KUMAUN_SHOT_* launch environment. Credentials are never part of the bundle.
 */
export interface ShotConfig {
  readonly email: string;
  readonly password: string;
  readonly route: string;
  readonly click: string | null;
  readonly delayMs: number;
}

const ROUTE_PATTERN = /^\/[a-z]+(\/[a-z]+)*\/?(\?[a-z]+=[a-z]+)?$/;
const MAX_CLICK_TEXT = 80;
const DEFAULT_DELAY_MS = 2500;
const MAX_DELAY_MS = 20000;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Returns a validated config, or null when anything required is missing or malformed. */
export function parseShotConfig(raw: unknown): ShotConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const email = str(r.email);
  const password = str(r.password);
  const route = str(r.route) || '/dashboard/';
  if (!email || !password || !ROUTE_PATTERN.test(route)) return null;
  const click = str(r.click).trim();
  if (click.length > MAX_CLICK_TEXT) return null;
  const delay = Number(r.delayMs);
  const delayMs = Number.isFinite(delay) && delay >= 0 ? Math.min(delay, MAX_DELAY_MS) : DEFAULT_DELAY_MS;
  return { email, password, route, click: click || null, delayMs };
}

export function readShotConfig(): ShotConfig | null {
  if (typeof window === 'undefined') return null;
  return parseShotConfig((window as unknown as { __KUMAUN_SHOT__?: unknown }).__KUMAUN_SHOT__);
}

/** Finds the smallest element whose own text contains `text` (case-insensitive). */
export function findClickTarget(doc: Document, text: string): HTMLElement | null {
  const needle = text.toLowerCase();
  const all = Array.from(doc.querySelectorAll<HTMLElement>('main *, [role="dialog"] *'));
  const hits = all.filter((el) => (el.textContent ?? '').toLowerCase().includes(needle));
  const smallest = hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
  return smallest[0] ?? null;
}
