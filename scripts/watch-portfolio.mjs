/**
 * Watches ~/Documents/Photography/Portfolio for new images.
 * Gallery assignments come from a tags.json sidecar file in that folder.
 *
 * tags.json format:
 * {
 *   "photo1.jpg": { "galleries": ["portraits"], "featured": true, "title": "Em Yeu", "alt": "..." },
 *   "photo2.jpg": { "galleries": ["landscape", "portraits"], "featured": false }
 * }
 *
 * Any image NOT in tags.json is uploaded to gallery ["uncategorized"].
 * Edit tags.json at any time — already-uploaded photos can be re-tagged via PATCH.
 *
 * Usage:
 *   node scripts/watch-portfolio.mjs
 *   (reads WORKER_URL and UPLOAD_SECRET from scripts/.env)
 */

import chokidar from 'chokidar';
import { readFile, writeFile } from 'node:fs/promises';
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
    if (eqIdx > 0) {
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      if (k) process.env[k] = v;
    }
  }
} catch { /* no .env, rely on env vars */ }

const WORKER_URL    = process.env.PUBLIC_WORKER_URL;
const UPLOAD_SECRET = process.env.UPLOAD_SECRET;
const WATCH_DIR     = path.join(homedir(), 'Documents', 'Photography', 'Portfolio');
const TAGS_FILE     = path.join(WATCH_DIR, 'tags.json');
const IMAGE_EXTS    = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

if (!WORKER_URL || !UPLOAD_SECRET) {
  console.error('Missing PUBLIC_WORKER_URL or UPLOAD_SECRET in scripts/.env');
  process.exit(1);
}

async function readTags() {
  if (!existsSync(TAGS_FILE)) return {};
  try {
    return JSON.parse(await readFile(TAGS_FILE, 'utf8'));
  } catch {
    console.warn('⚠ Could not parse tags.json — using empty tags');
    return {};
  }
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

async function uploadPhoto(filePath) {
  const filename = path.basename(filePath);
  const tags = await readTags();
  const meta = tags[filename] ?? {};

  const galleries = meta.galleries ?? ['uncategorized'];
  const featured  = meta.featured  ?? false;
  const title     = meta.title     ?? '';
  const alt       = meta.alt       ?? '';
  const ratio     = await getImageRatio(filePath);
  const year      = new Date().getFullYear();

  console.log(`↑ ${filename} → galleries: [${galleries.join(', ')}]${featured ? ' ★' : ''}`);

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
    console.error(`✗ Failed: ${await res.text()}`);
    return;
  }

  const data = await res.json();
  console.log(`✓ ${filename} uploaded — ID: ${data.id}`);
  console.log(`  Edit later: PATCH ${WORKER_URL}/photos/${data.id}`);
}

async function ensureTagsFile() {
  if (existsSync(TAGS_FILE)) return;
  const example = {
    'example.jpg': {
      galleries: ['portraits'],
      featured: false,
      title: '',
      alt: '',
    },
  };
  await writeFile(TAGS_FILE, JSON.stringify(example, null, 2));
  console.log(`Created ${TAGS_FILE} — edit it to tag your photos before dropping them in.`);
}

function isImage(filePath) {
  return IMAGE_EXTS.has(path.extname(filePath).toLowerCase());
}

await ensureTagsFile();

console.log(`Watching ${WATCH_DIR}`);
console.log('Edit tags.json to assign galleries, then drop images in to upload.\n');

chokidar
  .watch(WATCH_DIR, {
    ignored: [/(^|[/\\])\./, TAGS_FILE],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  })
  .on('add', (filePath) => {
    if (isImage(filePath)) uploadPhoto(filePath);
  });
