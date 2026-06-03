export interface Env {
  DB: D1Database;
  CF_IMAGES_ACCOUNT_ID: string;
  CF_IMAGES_API_TOKEN: string;
  UPLOAD_SECRET: string;
  CORS_ORIGIN: string;
}

interface PhotoRow {
  id: string;
  filename: string;
  galleries: string; // JSON array string stored in D1
  ratio: string;
  title: string;
  alt: string;
  year: number;
  featured: number;
  uploaded_at: string;
}

export interface Photo {
  id: string;
  filename: string;
  galleries: string[];
  ratio: string;
  title: string;
  alt: string;
  year: number;
  featured: boolean;
  uploaded_at: string;
}

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif']);

function cors(env: Env) {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data: unknown, env: Env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

function unauthorized(env: Env) {
  return json({ error: 'Unauthorized' }, env, 401);
}

function isAuthorized(request: Request, env: Env) {
  const auth = request.headers.get('Authorization') ?? '';
  return auth === `Bearer ${env.UPLOAD_SECRET}`;
}

function deserializePhoto(row: PhotoRow): Photo {
  return {
    ...row,
    galleries: JSON.parse(row.galleries) as string[],
    featured: row.featured === 1,
  };
}

async function uploadToCFImages(file: File, env: Env): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_IMAGES_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CF Images upload failed: ${err}`);
  }

  const data = await res.json<{ result: { id: string } }>();
  return data.result.id;
}

// POST /upload
// Multipart body: file, galleries (JSON array string), ratio, title, alt, year, featured
async function handleUpload(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const form = await request.formData();
  const file = form.get('file') as File | null;

  if (!file) return json({ error: 'No file provided' }, env, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return json({ error: `File type .${ext} not allowed` }, env, 400);
  }

  const galleriesRaw = (form.get('galleries') as string | null) ?? '["uncategorized"]';
  const galleries = JSON.parse(galleriesRaw) as string[];
  const ratio = (form.get('ratio') as string | null) ?? 'tall';
  const title = (form.get('title') as string | null) ?? '';
  const alt = (form.get('alt') as string | null) ?? '';
  const year = parseInt((form.get('year') as string | null) ?? String(new Date().getFullYear()), 10);
  const featured = (form.get('featured') as string | null) === 'true' ? 1 : 0;

  const imageId = await uploadToCFImages(file, env);

  await env.DB.prepare(
    `INSERT INTO photos (id, filename, galleries, ratio, title, alt, year, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(imageId, file.name, JSON.stringify(galleries), ratio, title, alt, year, featured)
    .run();

  return json({ id: imageId, galleries, filename: file.name }, env, 201);
}

// GET /photos?gallery=portraits&featured=true
async function handleGetPhotos(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const gallery = url.searchParams.get('gallery');
  const featuredOnly = url.searchParams.get('featured') === 'true';

  let query = 'SELECT * FROM photos WHERE 1=1';
  const bindings: (string | number)[] = [];

  if (gallery) {
    // json_each lets us filter rows where the galleries JSON array contains the value
    query = `SELECT photos.* FROM photos, json_each(photos.galleries)
             WHERE json_each.value = ?`;
    bindings.push(gallery);
    if (featuredOnly) {
      query += ' AND photos.featured = 1';
    }
  } else if (featuredOnly) {
    query += ' AND featured = 1';
  }

  query += ' ORDER BY uploaded_at DESC';

  const { results } = await env.DB.prepare(query).bind(...bindings).all<PhotoRow>();
  return json(results.map(deserializePhoto), env);
}

// GET /galleries — slug, name, count, tagline, ageGated
// Always returns all known galleries; count is 0 if no photos are tagged to it yet.
async function handleGetGalleries(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT json_each.value AS slug, COUNT(*) AS count
     FROM photos, json_each(photos.galleries)
     GROUP BY json_each.value`
  ).all<{ slug: string; count: number }>();

  const counts = Object.fromEntries(results.map((r) => [r.slug, r.count]));

  const meta: Record<string, { name: string; tagline: string; ageGated: boolean }> = {
    portraits: { name: 'Portraits', tagline: 'faces, moods, and the occasional glare', ageGated: false },
    grad:      { name: 'Graduation', tagline: 'capturing success', ageGated: false },
    landscape: { name: 'Landscape', tagline: "the world when nobody's looking", ageGated: false },
    boudoir:   { name: 'Boudoir', tagline: 'intimate, intentional, 18+', ageGated: true },
  };

  const galleries = Object.entries(meta).map(([slug, info]) => ({
    slug,
    count: counts[slug] ?? 0,
    ...info,
  }));

  return json(galleries, env);
}

// PATCH /photos/:id
async function handleUpdatePhoto(id: string, request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const body = await request.json<Partial<Photo>>();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (body.title !== undefined)     { fields.push('title = ?');     values.push(body.title); }
  if (body.alt !== undefined)       { fields.push('alt = ?');       values.push(body.alt); }
  if (body.ratio !== undefined)     { fields.push('ratio = ?');     values.push(body.ratio); }
  if (body.galleries !== undefined) { fields.push('galleries = ?'); values.push(JSON.stringify(body.galleries)); }
  if (body.featured !== undefined)  { fields.push('featured = ?');  values.push(body.featured ? 1 : 0); }

  if (fields.length === 0) return json({ error: 'No fields to update' }, env, 400);

  values.push(id);
  await env.DB.prepare(`UPDATE photos SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return json({ ok: true }, env);
}

// DELETE /photos/:id
async function handleDeletePhoto(id: string, request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_IMAGES_ACCOUNT_ID}/images/v1/${id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}` } }
  );

  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();
  return json({ ok: true }, env);
}

// GET /heroes/:page — returns the hero photo_id for a page, or null
async function handleGetHero(page: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare('SELECT photo_id FROM heroes WHERE page = ?')
    .bind(page)
    .first<{ photo_id: string }>();
  return json(row ? { photoId: row.photo_id } : null, env);
}

// PUT /heroes/:page — set or replace the hero for a page
async function handleSetHero(page: string, request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  const { photoId } = await request.json<{ photoId: string }>();
  if (!photoId) return json({ error: 'photoId required' }, env, 400);

  await env.DB.prepare(
    `INSERT INTO heroes (page, photo_id) VALUES (?, ?)
     ON CONFLICT(page) DO UPDATE SET photo_id = excluded.photo_id, updated_at = datetime('now')`
  ).bind(page, photoId).run();

  return json({ ok: true, page, photoId }, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { method } = request;
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (method === 'POST' && pathname === '/upload')    return handleUpload(request, env);
    if (method === 'GET'  && pathname === '/photos')    return handleGetPhotos(request, env);
    if (method === 'GET'  && pathname === '/galleries') return handleGetGalleries(env);

    const photoMatch = pathname.match(/^\/photos\/([^/]+)$/);
    if (photoMatch) {
      const id = photoMatch[1];
      if (method === 'PATCH')  return handleUpdatePhoto(id, request, env);
      if (method === 'DELETE') return handleDeletePhoto(id, request, env);
    }

    const heroMatch = pathname.match(/^\/heroes\/([^/]+)$/);
    if (heroMatch) {
      const page = heroMatch[1];
      if (method === 'GET') return handleGetHero(page, env);
      if (method === 'PUT') return handleSetHero(page, request, env);
    }

    return json({ error: 'Not found' }, env, 404);
  },
};
