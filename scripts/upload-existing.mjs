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
import { fileURLToPath } from 'node:url';

// Load scripts/.env
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
const WATCH_DIR     = path.join(homedir(), 'Documents', 'Photography', 'Portfolio');
const TAGS_FILE     = path.join(WATCH_DIR, 'tags.json');
const IMAGE_EXTS    = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

if (!WORKER_URL || !UPLOAD_SECRET) {
  console.error('Missing PUBLIC_WORKER_URL or UPLOAD_SECRET in scripts/.env');
  process.exit(1);
}

async function getImageRatio(filePath) {
  try {
    const { imageSize } = await import('image-size');
    const { width, height } = imageSize(filePath);
    if (!width || !height) return 'tall';
    const ratio = width / height;
    if (ratio > 1.2)  return 'wide';
    if (ratio < 0.85) return 'tall';
    return 'square';
  } catch {
    return 'tall';
  }
}

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
