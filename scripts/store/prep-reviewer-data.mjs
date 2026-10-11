#!/usr/bin/env node
/**
 * Adds the extra demo data the store screenshots need to the REVIEWER account:
 * Philippine peso, a weekly budget, onboarding completed, and a few finished shopping trips
 * with prices so the Budget screen has spending to show. AI consent is NOT touched.
 *
 *   EMAIL=... PASSWORD=... node scripts/store/prep-reviewer-data.mjs
 *   (optional) API=https://kitcha-api-production.up.railway.app
 *
 * Refuses to run for any account other than the seeded reviewer (name "App Reviewer").
 * The password is read from the environment only and never printed.
 */
const API = process.env.API ?? 'https://kitcha-api-production.up.railway.app';
const { EMAIL, PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error('Set EMAIL and PASSWORD in the environment.');
  process.exit(1);
}
const DAY = 86400000;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

async function call(method, path, token, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json: json?.data ?? json };
}

// [daysAgo, [[name, qty, unit, category, priceCents]]]
const TRIPS = [
  [1, [['sardines', 4, 'pieces', 'protein', 9600], ['kangkong', 2, 'pieces', 'vegetable', 6000], ['rice 5kg', 1, 'pieces', 'grains', 32500]]],
  [4, [['pork belly', 1, 'kg', 'protein', 38000], ['soy sauce', 1, 'pieces', 'spices', 4500], ['calamansi', 1, 'kg', 'fruit', 7000]]],
  [9, [['chicken breast', 2, 'kg', 'protein', 41000], ['carrots', 1, 'kg', 'vegetable', 8500], ['cooking oil', 1, 'liters', 'other', 12500]]],
  [16, [['eggs tray', 2, 'pieces', 'protein', 24000], ['bananas', 2, 'kg', 'fruit', 9000], ['pandesal', 2, 'pieces', 'grains', 7000]]],
];

const login = await call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
const token = login.json?.token;
if (login.status !== 200 || !token) { console.error(`Login failed (HTTP ${login.status}).`); process.exit(1); }
const me = login.json?.user;
if (me?.firstName !== 'App' || me?.lastName !== 'Reviewer') {
  console.error('Refusing: this is not the seeded reviewer account.');
  process.exit(1);
}

const prefs = await call('PATCH', '/users/preferences', token, { currency: 'PHP', budgetPerWeekCents: 350000 });
console.log(`preferences: HTTP ${prefs.status}`);
const onboarding = await call('POST', '/users/onboarding/complete', token);
console.log(`onboarding: HTTP ${onboarding.status}`);

for (const [ago, items] of TRIPS) {
  for (const [itemName, quantity, unit, category, cents] of items) {
    const r = await call('POST', '/shopping/items', token, {
      itemName, quantity, unit, category, costEstimateCents: cents, actualCostCents: cents, isChecked: true,
    });
    if (r.status !== 201 && r.status !== 200) console.warn(`item ${itemName}: HTTP ${r.status}`);
  }
  const fin = await call('POST', '/shopping/finish', token, {
    carryOver: 'carry', receiptDate: isoDay(-ago), addToPantry: false,
  });
  console.log(`trip ${ago}d ago: HTTP ${fin.status}`);
}
