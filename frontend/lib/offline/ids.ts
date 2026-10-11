export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues: (a: Uint8Array) => Uint8Array;
}

function formatV4(bytes: Uint8Array): string {
  const b = Uint8Array.from(bytes);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** RFC 4122 v4 id; works where crypto.randomUUID is missing (iOS 15.0-15.3 WKWebView). */
export function newId(cryptoLike: CryptoLike = globalThis.crypto as CryptoLike): string {
  if (typeof cryptoLike.randomUUID === 'function') return cryptoLike.randomUUID();
  return formatV4(cryptoLike.getRandomValues(new Uint8Array(16)));
}
