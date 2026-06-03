/**
 * Syncs tags.json metadata to already-uploaded photos in D1.
 * Compares tags.json against live D1 records by filename and
 * PATCHes any photos where featured, galleries, title, or alt changed.
 *
 * Usage:
 *   node scripts/sync-tags.mjs
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
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
const TAGS_FILE     = path.join(homedir(), 'Documents', 'Photography', 'Portfolio', 'tags.json');

if (!WORKER_URL || !UPLOAD_SECRET) {
  console.error('Missing PUBLIC_WORKER_URL or UPLOAD_SECRET in scripts/.env');
  process.exit(1);
}

if (!existsSync(TAGS_FILE)) {
  console.error(`tags.json not found at ${TAGS_FILE}`);
  process.exit(1);
}

const tags = JSON.parse(await readFile(TAGS_FILE, 'utf8'));

// Fetch all photos from D1
const res = await fetch(`${WORKER_URL}/photos`, {
  headers: { Authorization: `Bearer ${UPLOAD_SECRET}` },
});
const photos = await res.json();

console.log(`Found ${photos.length} photos in D1, ${Object.keys(tags).length} entries in tags.json\n`);

let updated = 0;
let skipped = 0;

for (const photo of photos) {
  const tag = tags[photo.filename];
  if (!tag) {
    skipped++;
    continue;
  }

  const changes = {};

  const tagGalleries  = tag.galleries ?? ['uncategorized'];
  const tagFeatured   = tag.featured  ?? false;
  const tagTitle      = tag.title     ?? '';
  const tagAlt        = tag.alt       ?? '';

  if (JSON.stringify(photo.galleries.sort()) !== JSON.stringify([...tagGalleries].sort()))
    changes.galleries = tagGalleries;
  if (photo.featured !== tagFeatured)
    changes.featured = tagFeatured;
  if (photo.title !== tagTitle)
    changes.title = tagTitle;
  if (photo.alt !== tagAlt)
    changes.alt = tagAlt;

  if (Object.keys(changes).length === 0) {
    skipped++;
    continue;
  }

  process.stdout.write(`↻ ${photo.filename} — updating: ${Object.keys(changes).join(', ')} … `);

  const patch = await fetch(`${WORKER_URL}/photos/${photo.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${UPLOAD_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(changes),
  });

  if (patch.ok) {
    console.log('✓');
    updated++;
  } else {
    console.log(`✗ ${await patch.text()}`);
  }
}

console.log(`\nDone — ${updated} updated, ${skipped} unchanged.`);
