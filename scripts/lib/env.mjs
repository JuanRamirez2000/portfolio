import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
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

export const WORKER_URL    = process.env.PUBLIC_WORKER_URL;
export const UPLOAD_SECRET = process.env.UPLOAD_SECRET;

if (!WORKER_URL || !UPLOAD_SECRET) {
  console.error('Missing PUBLIC_WORKER_URL or UPLOAD_SECRET in scripts/.env');
  process.exit(1);
}
