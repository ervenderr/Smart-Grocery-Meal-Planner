// One-off icon generator. Run from frontend/: node scripts/generate-icons.mjs
// Uses sharp (already resolvable as a transitive dependency of next); not a runtime/build dependency.
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const BRAND = '#0ea5e9';
const WHITE = '#ffffff';

const publicUrl = (p) => new URL(`../public/${p}`, import.meta.url);

const logoSvg = await readFile(publicUrl('kitcha-logo.svg'), 'utf8');
const whiteLogoSvg = logoSvg.replaceAll(BRAND, WHITE);

await mkdir(publicUrl('icons/'), { recursive: true });

async function markPng(svg, size) {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function compose({ canvas, background, svg, markRatio, out, opaque }) {
  const markSize = Math.round(canvas * markRatio);
  const mark = await markPng(svg, markSize);
  const offset = Math.round((canvas - markSize) / 2);
  let img = sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: mark, left: offset, top: offset }]);
  if (opaque) img = img.flatten({ background }).removeAlpha();
  await img.png().toFile(new URL(out, publicUrl('')).pathname);
}

const white = { r: 255, g: 255, b: 255, alpha: 1 };
const brand = { r: 14, g: 165, b: 233, alpha: 1 };

await compose({ canvas: 192, background: white, svg: logoSvg, markRatio: 0.7, out: 'icons/icon-192.png' });
await compose({ canvas: 512, background: white, svg: logoSvg, markRatio: 0.7, out: 'icons/icon-512.png' });
await compose({ canvas: 512, background: brand, svg: whiteLogoSvg, markRatio: 0.6, out: 'icons/icon-maskable-512.png' });
await compose({ canvas: 180, background: brand, svg: whiteLogoSvg, markRatio: 0.62, out: 'apple-touch-icon.png', opaque: true });
await compose({ canvas: 32, background: white, svg: logoSvg, markRatio: 0.9, out: 'icons/favicon-32.png' });

console.log('icons generated');
