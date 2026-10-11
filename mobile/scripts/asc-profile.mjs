// Create (or reuse) an App Store provisioning profile for app.kitcha.mobile and install it locally.
// Usage: node asc-profile.mjs <distribution-cert-id>   (prints the profile name and uuid)
import { api } from './asc-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BUNDLE = 'app.kitcha.mobile';
const NAME = 'Kumaun App Store';
const certId = process.argv[2];
if (!certId) { console.error('usage: asc-profile.mjs <cert-id>'); process.exit(2); }

const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}`);
const bundleId = bundles.data.find((b) => b.attributes.identifier === BUNDLE)?.id;
if (!bundleId) throw new Error('bundle id not registered');

const existing = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(NAME)}`);
for (const p of existing.data) await api('DELETE', `/v1/profiles/${p.id}`); // recreate against the current cert

const created = await api('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: NAME, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundleId } },
      certificates: { data: [{ type: 'certificates', id: certId }] },
    },
  },
});
const { uuid, profileContent } = created.data.attributes;
const dir = join(homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${uuid}.mobileprovision`), Buffer.from(profileContent, 'base64'));
console.log(`${NAME} ${uuid}`);
