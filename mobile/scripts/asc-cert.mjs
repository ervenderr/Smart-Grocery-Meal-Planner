// Create an Apple Distribution certificate from <dir>/dist.csr; writes <dir>/dist.cer; prints the cert id.
import { api } from './asc-api.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const r = await api('POST', '/v1/certificates', {
  data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: readFileSync(`${dir}/dist.csr`, 'utf8') } },
});
writeFileSync(`${dir}/dist.cer`, Buffer.from(r.data.attributes.certificateContent, 'base64'));
console.log(r.data.id);
