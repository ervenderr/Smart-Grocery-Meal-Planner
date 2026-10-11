// Poll App Store Connect until the uploaded build is VALID, then make it available to an internal
// TestFlight group that contains the account owner.
// Usage: node asc-testflight.mjs [wait|status] [buildNumber]   (default: wait, latest build in build/archive/BUILD_NUMBER)
import { api } from './asc-api.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const BUNDLE = 'app.kitcha.mobile';
const GROUP = 'Internal Testers';
const mode = process.argv[2] || 'wait';
const buildNo = process.argv[3] || readFileSync(join(here, '..', 'build', 'archive', 'BUILD_NUMBER'), 'utf8').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`[testflight] ${m}`);

const app = (await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`)).data[0];
if (!app) throw new Error('app not found');

async function findBuild() {
  const r = await api('GET', `/v1/builds?filter[app]=${app.id}&filter[version]=${buildNo}&limit=5`);
  return r.data[0];
}

let build = await findBuild();
const deadline = Date.now() + 45 * 60 * 1000;
while (mode === 'wait' && (!build || build.attributes.processingState === 'PROCESSING') && Date.now() < deadline) {
  log(build ? `processing (${build.attributes.processingState})...` : 'build not visible yet...');
  await sleep(30000);
  build = await findBuild();
}
if (!build) { log(`build ${buildNo} not found`); process.exit(1); }
log(`build ${buildNo}: processingState=${build.attributes.processingState} expired=${build.attributes.expired} usesNonExemptEncryption=${build.attributes.usesNonExemptEncryption}`);
if (build.attributes.processingState !== 'VALID') process.exit(build.attributes.processingState === 'PROCESSING' ? 3 : 1);

// Export compliance: set explicitly if Apple is still waiting for an answer.
if (build.attributes.usesNonExemptEncryption === null) {
  await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
  log('export compliance set: no non-exempt encryption');
}

// Internal group containing the account owner.
const groups = await api('GET', `/v1/apps/${app.id}/betaGroups?limit=50`);
let group = groups.data.find((g) => g.attributes.isInternalGroup && g.attributes.name === GROUP)
  || groups.data.find((g) => g.attributes.isInternalGroup);
if (!group) {
  group = (await api('POST', '/v1/betaGroups', {
    data: { type: 'betaGroups', attributes: { name: GROUP, isInternalGroup: true, hasAccessToAllBuilds: true },
      relationships: { app: { data: { type: 'apps', id: app.id } } } },
  })).data;
  log(`created internal group "${GROUP}"`);
}
const users = (await api('GET', '/v1/users?limit=200')).data
  .filter((u) => u.attributes.roles.some((r) => ['ACCOUNT_HOLDER', 'ADMIN'].includes(r)));
const testers = (await api('GET', `/v1/betaGroups/${group.id}/betaTesters?limit=200`)).data.map((t) => t.attributes.email?.toLowerCase());
for (const u of users) {
  const email = u.attributes.username.toLowerCase();
  if (testers.includes(email)) { log(`tester already in group: ${u.attributes.firstName}`); continue; }
  try {
    await api('POST', '/v1/betaTesters', {
      data: { type: 'betaTesters', attributes: { email, firstName: u.attributes.firstName, lastName: u.attributes.lastName },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } } },
    });
    log(`added ${u.attributes.firstName} to "${group.attributes.name}"`);
  } catch (e) { log(`could not add ${u.attributes.firstName}: ${e.message}`); }
}

// Internal groups created with hasAccessToAllBuilds receive every processed build automatically.
const bb = await api('GET', `/v1/builds/${build.id}/buildBetaDetail`);
log(`internalBuildState=${bb.data.attributes.internalBuildState} autoNotify=${bb.data.attributes.autoNotifyEnabled}`);
