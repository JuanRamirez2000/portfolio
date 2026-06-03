/**
 * Set the hero image for a page.
 *
 * Usage:
 *   node scripts/set-hero.mjs <page> <photoId>
 *
 * Pages: landing | portraits | landscape | grad | boudoir
 *
 * Example:
 *   node scripts/set-hero.mjs portraits abc123-cf-image-id
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
try {
  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
  }
} catch { /* rely on env vars */ }

const WORKER_URL    = process.env.PUBLIC_WORKER_URL;
const UPLOAD_SECRET = process.env.UPLOAD_SECRET;
const [page, photoId] = process.argv.slice(2);

if (!WORKER_URL || !UPLOAD_SECRET) {
  console.error('Missing PUBLIC_WORKER_URL or UPLOAD_SECRET in scripts/.env');
  process.exit(1);
}

if (!page || !photoId) {
  console.error('Usage: node scripts/set-hero.mjs <page> <photoId>');
  console.error('Pages: landing | portraits | landscape | grad | boudoir');
  process.exit(1);
}

const res = await fetch(`${WORKER_URL}/heroes/${page}`, {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${UPLOAD_SECRET}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ photoId }),
});

const data = await res.json();
if (res.ok) {
  console.log(`✓ Hero set for "${page}" → ${photoId}`);
} else {
  console.error(`✗ Failed: ${JSON.stringify(data)}`);
}
