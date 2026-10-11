#!/usr/bin/env node
/**
 * Uploads docs/store/screenshots/<dir> into an App Store Connect screenshot set (reserve, upload,
 * commit with MD5). Replaces any screenshots already in the set. Credentials: ~/.appstoreconnect/env.
 *
 *   node scripts/store/asc-upload-screenshots.mjs <localizationId> <APP_IPHONE_67|APP_IPAD_PRO_3GEN_129> <dir>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { api } from '../../mobile/scripts/asc-api.mjs';

const [locId, displayType, dir] = process.argv.slice(2);
if (!locId || !displayType || !dir) {
  console.error('usage: asc-upload-screenshots.mjs <localizationId> <displayType> <dir>');
  process.exit(2);
}
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (files.length === 0 || files.length > 10) throw new Error(`need 1-10 PNGs in ${dir}`);

const sets = await api('GET', `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?include=appScreenshots`);
let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
if (!set) {
  set = (await api('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: displayType },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } },
    },
  })).data;
}
for (const s of (sets.included ?? []).filter((i) => i.type === 'appScreenshots')) {
  if (set.relationships?.appScreenshots?.data?.some((d) => d.id === s.id)) await api('DELETE', `/v1/appScreenshots/${s.id}`);
}

const ids = [];
for (const name of files) {
  const buf = readFileSync(join(dir, name));
  const res = (await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: name, fileSize: statSync(join(dir, name)).size },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
    },
  })).data;
  for (const op of res.attributes.uploadOperations) {
    const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
    if (!r.ok) throw new Error(`upload ${name} part failed: HTTP ${r.status}`);
  }
  await api('PATCH', `/v1/appScreenshots/${res.id}`, {
    data: { type: 'appScreenshots', id: res.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(buf).digest('hex') } },
  });
  ids.push(res.id);
  console.log(`uploaded ${name}`);
}
await api('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
  data: ids.map((id) => ({ type: 'appScreenshots', id })),
});
for (let i = 0; i < 20; i += 1) {
  const st = await Promise.all(ids.map((id) => api('GET', `/v1/appScreenshots/${id}`)));
  const states = st.map((s) => s.data.attributes.assetDeliveryState.state);
  if (states.every((s) => s !== 'UPLOAD_COMPLETE' && s !== 'AWAITING_UPLOAD')) {
    console.log(`states: ${states.join(',')}`);
    const bad = st.filter((s) => s.data.attributes.assetDeliveryState.state === 'FAILED');
    if (bad.length) { console.error(JSON.stringify(bad.map((b) => b.data.attributes.assetDeliveryState.errors))); process.exit(1); }
    break;
  }
  await new Promise((r) => setTimeout(r, 3000));
}
