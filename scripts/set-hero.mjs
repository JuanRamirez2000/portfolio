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

import { WORKER_URL, UPLOAD_SECRET } from './lib/env.mjs';

const [page, photoId] = process.argv.slice(2);

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
