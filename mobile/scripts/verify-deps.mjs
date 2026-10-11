#!/usr/bin/env node
// Dependency legitimacy + version parity gate for the Capacitor iOS shell.
//
// Usage:
//   node mobile/scripts/verify-deps.mjs                 registry check + parity (when deps present)
//   node mobile/scripts/verify-deps.mjs --registry-only registry check only (run BEFORE installing)
//   node mobile/scripts/verify-deps.mjs --parity        offline parity/exact-pin check only
//
// Registry check: exact version exists, exact name matches (typosquat guard),
// repository.url contains the expected host prefix. Install scripts are reported.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const IONIC = 'github.com/ionic-team/';
const APARAJITA = 'github.com/aparajita/';
const CAP_COMMUNITY = 'github.com/capacitor-community/';
const VITEST = 'github.com/vitest-dev/';

export const EXPECTED = Object.freeze([
  { name: '@capacitor/core', version: '8.5.3', repo: IONIC },
  { name: '@capacitor/ios', version: '8.5.3', repo: IONIC },
  { name: '@capacitor/cli', version: '8.5.3', repo: IONIC },
  { name: '@capacitor/barcode-scanner', version: '3.1.3', repo: IONIC },
  { name: '@capacitor/local-notifications', version: '8.3.1', repo: IONIC },
  { name: '@capacitor/haptics', version: '8.0.2', repo: IONIC },
  { name: '@capacitor/share', version: '8.0.3', repo: IONIC },
  { name: '@capacitor/status-bar', version: '8.0.4', repo: IONIC },
  { name: '@capacitor/splash-screen', version: '8.0.2', repo: IONIC },
  { name: '@capacitor/keyboard', version: '8.0.6', repo: IONIC },
  { name: '@capacitor/app', version: '8.1.2', repo: IONIC },
  { name: '@capacitor/device', version: '8.0.3', repo: IONIC },
  { name: '@aparajita/capacitor-secure-storage', version: '8.0.1', repo: APARAJITA },
  { name: '@capacitor-community/sqlite', version: '8.1.1', repo: CAP_COMMUNITY },
  { name: '@capacitor/network', version: '8.0.1', repo: IONIC },
  { name: '@vitest/coverage-v8', version: '5.0.3', repo: VITEST },
]);

function npmView(entry) {
  const spec = `${entry.name}@${entry.version}`;
  const out = execFileSync(
    'npm',
    [
      'view', spec, 'name', 'version', 'repository.url', 'time.modified',
      'scripts.preinstall', 'scripts.install', 'scripts.postinstall', '--json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(out);
}

function checkRegistry() {
  const failures = [];
  for (const entry of EXPECTED) {
    const spec = `${entry.name}@${entry.version}`;
    let info;
    try {
      info = npmView(entry);
    } catch {
      failures.push(`${spec}: version not found in registry`);
      console.error(`FAIL ${spec}: version not found in registry`);
      continue;
    }
    if (info.name !== entry.name) {
      failures.push(`${spec}: name mismatch (${info.name})`);
      console.error(`FAIL ${spec}: name mismatch (${info.name})`);
      continue;
    }
    if (info.version !== entry.version) {
      failures.push(`${spec}: version mismatch (${info.version})`);
      console.error(`FAIL ${spec}: version mismatch (${info.version})`);
      continue;
    }
    const repo = String(info['repository.url'] ?? '');
    if (!repo.includes(entry.repo)) {
      failures.push(`${spec}: unexpected repository ${repo}`);
      console.error(`FAIL ${spec}: unexpected repository "${repo}" (expected ${entry.repo})`);
      continue;
    }
    for (const hook of ['preinstall', 'install', 'postinstall']) {
      const script = info[`scripts.${hook}`];
      if (script) console.warn(`WARNING ${spec}: ${hook} script present: ${script}`);
    }
    console.log(`OK ${spec} repo=${repo} modified=${info['time.modified']}`);
  }
  return failures;
}

function readDeps(path) {
  if (!existsSync(path)) return null;
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

function checkParity() {
  const mobile = readDeps(join(root, 'mobile', 'package.json'));
  const frontend = readDeps(join(root, 'frontend', 'package.json'));
  const failures = [];
  if (!mobile || !frontend) return { failures, ran: false };
  const tracked = (name) => name.startsWith('@capacitor/') || name.startsWith('@aparajita/');
  for (const [label, deps] of [['mobile', mobile], ['frontend', frontend]]) {
    for (const [name, version] of Object.entries(deps)) {
      if (tracked(name) && !/^\d+\.\d+\.\d+$/.test(version)) {
        failures.push(`${label}: ${name} not an exact pin (${version})`);
      }
    }
  }
  for (const name of Object.keys(mobile)) {
    if (name in frontend && tracked(name) && mobile[name] !== frontend[name]) {
      failures.push(`parity: ${name} mobile=${mobile[name]} frontend=${frontend[name]}`);
    }
  }
  for (const f of failures) console.error(`FAIL ${f}`);
  if (failures.length === 0) console.log('OK parity: exact pins, identical shared versions');
  return { failures, ran: true };
}

const args = new Set(process.argv.slice(2));
let failures = [];
if (args.has('--parity')) {
  const result = checkParity();
  if (!result.ran) {
    console.error('FAIL parity: package.json missing in mobile/ or frontend/');
    process.exit(1);
  }
  failures = result.failures;
} else {
  failures = checkRegistry();
  if (!args.has('--registry-only')) failures = [...failures, ...checkParity().failures];
}
process.exit(failures.length === 0 ? 0 : 1);
