// Bundle-size regression budget (roadmap 6.6). Mirrors §4's coverage gate for
// performance: it fails CI if the JavaScript downloaded on initial page load
// grows past a set budget, so a heavy import landing on the critical path (e.g.
// pulling the forecast chart or date pickers back into the entry chunk) can't
// silently regress first paint.
//
// "Initial-load JS" is measured precisely from the built index.html: the entry
// <script type="module"> plus every <link rel="modulepreload"> — exactly what
// the browser fetches to boot the app. Lazy chunks (chart, popouts, forms, date
// pickers) are not referenced there and are correctly excluded.
//
// Run after `npm run build`. Bump the budget deliberately (with review) when an
// increase is intended.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, basename } from 'node:path';

const DIST = 'dist';
const ASSETS = join(DIST, 'assets');

// Gzipped budget for initial-load JavaScript.
const INITIAL_JS_GZIP_BUDGET_BYTES = 250 * 1024;

const fmt = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

const refs = new Set();

// Find the module entry <script> and its src independent of attribute order.
// Coupling to a fixed `type="module" ... src` ordering would let a future Vite
// output reorder the attributes, drop the entry chunk (the largest) from the
// total, and turn the gate into a false green — so a missing entry is a hard
// failure, never a partial measurement.
const entryTag = html.match(/<script\b[^>]*\btype="module"[^>]*>/);
const entrySrc = entryTag?.[0].match(/\bsrc="([^"]+)"/)?.[1];
if (!entrySrc) {
  console.error(
    'Bundle-size check: could not find the module entry <script src> in dist/index.html. Did `npm run build` run first, or did the build output format change?'
  );
  process.exit(1);
}
refs.add(basename(entrySrc));

// Add every modulepreload chunk, also independent of attribute order.
for (const tag of html.matchAll(/<link\b[^>]*>/g)) {
  if (!/\brel="modulepreload"/.test(tag[0])) continue;
  const href = tag[0].match(/\bhref="([^"]+)"/)?.[1];
  if (href) refs.add(basename(href));
}

const rows = [];
let totalRaw = 0;
let totalGzip = 0;
for (const name of refs) {
  const buf = readFileSync(join(ASSETS, name));
  const gzip = gzipSync(buf).length;
  totalRaw += buf.length;
  totalGzip += gzip;
  rows.push({ name, raw: buf.length, gzip });
}
rows.sort((a, b) => b.gzip - a.gzip);

console.log('Initial-load JavaScript (entry + modulepreload):');
for (const r of rows) {
  console.log(
    `  ${r.name.padEnd(46)} ${fmt(r.raw).padStart(10)}  gzip ${fmt(r.gzip).padStart(10)}`
  );
}
console.log(
  `  ${'TOTAL'.padEnd(46)} ${fmt(totalRaw).padStart(10)}  gzip ${fmt(totalGzip).padStart(10)}`
);
console.log(`Budget (gzip): ${fmt(INITIAL_JS_GZIP_BUDGET_BYTES)}`);

if (totalGzip > INITIAL_JS_GZIP_BUDGET_BYTES) {
  console.error(
    `\n✗ Initial JS ${fmt(totalGzip)} (gzip) exceeds budget ${fmt(INITIAL_JS_GZIP_BUDGET_BYTES)}.`
  );
  console.error(
    '  Code-split a heavy import (React.lazy) or raise the budget intentionally.'
  );
  process.exit(1);
}

console.log(
  `\n✓ Initial JS ${fmt(totalGzip)} (gzip) within budget ${fmt(INITIAL_JS_GZIP_BUDGET_BYTES)}.`
);
