// Rasterize the brand SVGs into the PNG icon set (roadmap 6.7). The SVGs are the
// editable source of truth; this regenerates the raster assets browsers/social
// scrapers need (SVG favicons aren't honored everywhere, and OG/Twitter images
// must be raster). Requires sharp as a one-off dev tool: `npm i -D sharp`, then
// `node scripts/generate-icons.mjs`.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const favicon = readFileSync(join(root, 'public/favicon.svg'));
const ogCard = readFileSync(join(root, 'scripts/og-card.svg'));

const targets = [
  { svg: favicon, size: 32, out: 'public/favicon-32.png' },
  { svg: favicon, size: 180, out: 'public/apple-touch-icon.png' },
  { svg: favicon, size: 512, out: 'public/icon-512.png' },
  { svg: ogCard, width: 1200, height: 630, out: 'public/og-image.png' },
];

for (const t of targets) {
  const resize = t.size
    ? { width: t.size, height: t.size }
    : { width: t.width, height: t.height };
  await sharp(t.svg, { density: 384 })
    .resize(resize)
    .png()
    .toFile(join(root, t.out));
  console.log(`✓ ${t.out} (${resize.width}×${resize.height})`);
}
