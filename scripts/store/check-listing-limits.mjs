#!/usr/bin/env node
// Verifies App Store text limits for fenced blocks in docs/store/LISTING.md.
// Heading format: "### <Field> (max N)" followed by a ```text fence.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? join(here, '..', '..', 'docs', 'store', 'LISTING.md');
const lines = readFileSync(file, 'utf8').split('\n');

let failed = false;
let limit = null;
let label = '';
let buf = null;
const results = [];

for (const line of lines) {
  const head = /^###\s+(.+?)\s+\(max\s+(\d+)\)\s*$/.exec(line);
  if (head && buf === null) {
    label = head[1];
    limit = Number(head[2]);
    continue;
  }
  if (limit !== null && buf === null && line.startsWith('```')) {
    buf = [];
    continue;
  }
  if (buf !== null) {
    if (line.startsWith('```')) {
      const text = buf.join('\n');
      // Apple counts characters; spread to count code points, not UTF-16 units.
      const count = [...text].length;
      const ok = count <= limit;
      const extra = label === 'Keywords' && /,\s|\s,/.test(text) ? ' (spaces around commas!)' : '';
      if (!ok || extra) failed = true;
      results.push(`${ok && !extra ? 'OK  ' : 'FAIL'} ${label}: ${count}/${limit}${extra}`);
      buf = null;
      limit = null;
    } else {
      buf.push(line);
    }
  }
}

console.log(results.join('\n'));
if (results.length === 0) {
  console.error('No limit-tagged blocks found');
  process.exit(2);
}
process.exit(failed ? 1 : 0);
