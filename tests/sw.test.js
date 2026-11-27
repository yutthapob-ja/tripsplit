import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every precached asset exists', () => {
  for (const a of assets) if (a !== './') assert.ok(existsSync(join(root, a)), a);
});

test('every app file is precached', () => {
  const walk = (d) => readdirSync(join(root, d)).flatMap((f) => statSync(join(root, d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]);
  for (const f of walk('src')) assert.ok(assets.includes(f), `missing in ASSETS: ${f}`);
});

test('precache bypasses HTTP cache', () => {
  assert.match(sw, /cache:\s*'reload'/);
});

test('cache version matches content hash of assets', () => {
  const h = createHash('sha256');
  for (const a of assets) if (a !== './') h.update(readFileSync(join(root, a)));
  const want = h.digest('hex').slice(0, 10);
  const got = sw.match(/const VERSION = '([^']+)'/)?.[1];
  assert.equal(got, want, 'run: npm run bump');
});
