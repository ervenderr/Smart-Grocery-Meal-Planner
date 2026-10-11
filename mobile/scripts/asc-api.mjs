// Tiny App Store Connect API client (ES256 JWT). Reads creds from ~/.appstoreconnect/env.
// Never logs the key, key id, issuer id, or token.
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://api.appstoreconnect.apple.com';

function loadEnv() {
  const file = process.env.ASC_ENV_FILE || join(homedir(), '.appstoreconnect', 'env');
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').replace(/^~(?=\/)|\$HOME|\${HOME}/, homedir());
  }
  for (const k of ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH']) {
    if (!out[k]) throw new Error(`${k} missing in env file`);
  }
  return out;
}

const b64u = (b) => Buffer.from(b).toString('base64url');

export function makeToken() {
  const env = loadEnv();
  const header = { alg: 'ES256', kid: env.ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: env.ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = createPrivateKey(readFileSync(env.ASC_KEY_PATH));
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64u(sig)}`;
}

export async function api(method, path, body) {
  const res = await fetch(path.startsWith('http') ? path : BASE + path, {
    method,
    headers: { Authorization: `Bearer ${makeToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.code}: ${e.detail || e.title}`).join('; ') || text.slice(0, 300);
    const err = new Error(`${method} ${path} -> ${res.status} ${detail}`);
    err.status = res.status;
    throw err;
  }
  return json;
}
