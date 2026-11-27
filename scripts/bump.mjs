import { fileURLToPath } from 'node:url';
// Recompute sw.js VERSION from the content of every precached asset.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const p = join(root, 'sw.js');
let sw = readFileSync(p, 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const h = createHash('sha256');
for (const a of assets) if (a !== './') h.update(readFileSync(join(root, a)));
const v = h.digest('hex').slice(0, 10);
sw = sw.replace(/const VERSION = '[^']*'/, `const VERSION = '${v}'`);
writeFileSync(p, sw);
console.log('VERSION', v);
