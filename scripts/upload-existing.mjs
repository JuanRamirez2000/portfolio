/**
 * One-shot upload of all images already in ~/Documents/Photography/Portfolio.
 * Reads tags.json for metadata, skips files already uploaded (checks by filename).
 *
 * Usage:
 *   node scripts/upload-existing.mjs
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { WORKER_URL, UPLOAD_SECRET } from './lib/env.mjs';
import { IMAGE_EXTS, getImageRatio } from './lib/image.mjs';

const WATCH_DIR = path.join(homedir(), 'Documents', 'Photography', 'Portfolio');
const TAGS_FILE = path.join(WATCH_DIR, 'tags.json');

// Fetch filenames already in D1 so we don't double-upload
async function getUploadedFilenames() {
  const res = await fetch(`${WORKER_URL}/photos`, {
    headers: { Authorization: `Bearer ${UPLOAD_SECRET}` },
  });
  if (!res.ok) return new Set();
  const photos = await res.json();
  return new Set(photos.map((p) => p.filename));
}

const tags = existsSync(TAGS_FILE)
  ? JSON.parse(await readFile(TAGS_FILE, 'utf8'))
  : {};

const allFiles = (await readdir(WATCH_DIR))
  .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
  .sort();

console.log(`Found ${allFiles.length} images in ${WATCH_DIR}`);
console.log('Checking which are already uploaded...\n');

const uploaded = await getUploadedFilenames();
const toUpload = allFiles.filter(f => !uploaded.has(f));

if (toUpload.length === 0) {
  console.log('All images already uploaded.');
  process.exit(0);
}

console.log(`Uploading ${toUpload.length} new images (${uploaded.size} already done).\n`);

let success = 0;
let failed  = 0;

for (const filename of toUpload) {
  const filePath = path.join(WATCH_DIR, filename);
  const meta = tags[filename] ?? {};

  const galleries = meta.galleries ?? ['uncategorized'];
  const featured  = meta.featured  ?? false;
  const title     = meta.title     ?? '';
  const alt       = meta.alt       ?? '';
  const ratio     = await getImageRatio(filePath);
  const year      = new Date().getFullYear();

  process.stdout.write(`↑ ${filename} → [${galleries.join(', ')}] … `);

  try {
    const fileBuffer = await readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([fileBuffer]), filename);
    form.append('galleries', JSON.stringify(galleries));
    form.append('ratio', ratio);
    form.append('title', title);
    form.append('alt', alt);
    form.append('year', String(year));
    form.append('featured', String(featured));

    const res = await fetch(`${WORKER_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPLOAD_SECRET}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`✗ ${text}`);
      failed++;
    } else {
      const data = await res.json();
      console.log(`✓ ${data.id}`);
      success++;
    }
  } catch (err) {
    console.log(`✗ ${err.message}`);
    failed++;
  }
}

console.log(`\nDone — ${success} uploaded, ${failed} failed.`);
