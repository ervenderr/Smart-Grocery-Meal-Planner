import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// IN-01: the release native build must scrub inherited E2E env vars before `next build`.
const script = readFileSync(fileURLToPath(new URL('../../../mobile/scripts/frontend-build.sh', import.meta.url)), 'utf8');
const E2E_VARS = [
  'NEXT_PUBLIC_E2E',
  'NEXT_PUBLIC_E2E_EMAIL',
  'NEXT_PUBLIC_E2E_PASSWORD',
  'NEXT_PUBLIC_E2E_SUITE',
  'NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY',
];

describe('mobile/scripts/frontend-build.sh release branch', () => {
  const release = script.slice(script.indexOf('  else\n', script.indexOf('build_native()')), script.indexOf('  fi\n', script.indexOf('build_native()')));

  it('runs next build through env with every E2E var unset', () => {
    expect(release).toContain('env ');
    expect(release).toContain('npx next build');
    for (const name of E2E_VARS) expect(release).toContain(`-u ${name} `);
  });
});
