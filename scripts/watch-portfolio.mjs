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
import { WORKER_URL, UPLOAD_SECRET } from './lib/env.mjs';
import { IMAGE_EXTS, getImageRatio } from './lib/image.mjs';

const WATCH_DIR = path.join(homedir(), 'Documents', 'Photography', 'Portfolio');
const TAGS_FILE = path.join(WATCH_DIR, 'tags.json');

async function readTags() {
  if (!existsSync(TAGS_FILE)) return {};
  try {
    return JSON.parse(await readFile(TAGS_FILE, 'utf8'));
  } catch {
    console.warn('⚠ Could not parse tags.json — using empty tags');
    return {};
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
