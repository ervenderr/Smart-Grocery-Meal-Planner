#!/usr/bin/env node
/**
 * Changes an account password through the public API.
 *   EMAIL=... OLD_PASSWORD='...' NEW_PASSWORD='...' node scripts/change-password.mjs
 * Passwords are read from the environment only and never logged.
 */
const API = process.env.API ?? 'https://kitcha-api-production.up.railway.app';
const { EMAIL, OLD_PASSWORD, NEW_PASSWORD } = process.env;
if (!EMAIL || !OLD_PASSWORD || !NEW_PASSWORD) {
  console.error('Set EMAIL, OLD_PASSWORD and NEW_PASSWORD.');
  process.exit(1);
}
const post = (path, body, token, method = 'POST') =>
  fetch(`${API}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
const login = await post('/auth/login', { email: EMAIL, password: OLD_PASSWORD });
if (!login.ok) {
  console.error(`Login failed (HTTP ${login.status}).`);
  process.exit(1);
}
const { token } = await login.json();
const res = await post('/users/password', { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD }, token, 'PATCH');
console.log(res.ok ? 'Password changed.' : `Change failed (HTTP ${res.status}): ${await res.text()}`);
