export interface Env {
  DB: D1Database;
  CF_IMAGES_ACCOUNT_ID: string;
  CF_IMAGES_API_TOKEN: string;
  UPLOAD_SECRET: string;
  CORS_ORIGIN: string;
  GH_TOKEN: string;
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

function cors(env: Env, origin: string | null) {
  const allowed = env.CORS_ORIGIN.split(',').map(o => o.trim());
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gallery-Token',
    'Vary': 'Origin',
  };
}

function json(data: unknown, env: Env, origin: string | null, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env, origin) },
  });
}

function unauthorized(env: Env, origin: string | null) {
  return json({ error: 'Unauthorized' }, env, origin, 401);
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
async function handleUpload(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);

  const form = await request.formData();
  const file = form.get('file') as File | null;

  if (!file) return json({ error: 'No file provided' }, env, origin, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return json({ error: `File type .${ext} not allowed` }, env, origin, 400);
  }

  const galleriesRaw = (form.get('galleries') as string | null) ?? '["uncategorized"]';
  const galleries = JSON.parse(galleriesRaw) as string[];
  const ratio = (form.get('ratio') as string | null) ?? 'tall';
  const title = (form.get('title') as string | null) ?? '';
  const alt = (form.get('alt') as string | null) ?? '';
  const year = parseInt((form.get('year') as string | null) ?? String(new Date().getFullYear()), 10);
  const featured = (form.get('featured') as string | null) === 'true' ? 1 : 0;

  const imageId = await uploadToCFImages(file, env);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO photos (id, filename, galleries, ratio, title, alt, year, featured, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(imageId, file.name, JSON.stringify(galleries), ratio, title, alt, year, featured, now)
    .run();

  return json({ id: imageId, galleries, filename: file.name, uploaded_at: now, ratio, title, alt, year, featured: featured === 1 }, env, origin, 201);
}

// GET /photos?gallery=portraits&featured=true
async function handleGetPhotos(request: Request, env: Env, origin: string | null): Promise<Response> {
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
  return json(results.map(deserializePhoto), env, origin);
}

// GET /galleries — slug, name, count, tagline, ageGated
// Always returns all known galleries; count is 0 if no photos are tagged to it yet.
async function handleGetGalleries(env: Env, origin: string | null): Promise<Response> {
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

  return json(galleries, env, origin);
}

// PATCH /photos/:id
async function handleUpdatePhoto(id: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);

  const body = await request.json<Partial<Photo>>();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (body.title !== undefined)     { fields.push('title = ?');     values.push(body.title); }
  if (body.alt !== undefined)       { fields.push('alt = ?');       values.push(body.alt); }
  if (body.ratio !== undefined)     { fields.push('ratio = ?');     values.push(body.ratio); }
  if (body.galleries !== undefined) { fields.push('galleries = ?'); values.push(JSON.stringify(body.galleries)); }
  if (body.featured !== undefined)  { fields.push('featured = ?');  values.push(body.featured ? 1 : 0); }

  if (fields.length === 0) return json({ error: 'No fields to update' }, env, origin, 400);

  values.push(id);
  await env.DB.prepare(`UPDATE photos SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return json({ ok: true }, env, origin);
}

// DELETE /photos/:id
async function handleDeletePhoto(id: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);

  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_IMAGES_ACCOUNT_ID}/images/v1/${id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}` } }
  );

  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();
  return json({ ok: true }, env, origin);
}

// GET /heroes/:page — returns the hero photo_id for a page, or null
async function handleGetHero(page: string, env: Env, origin: string | null): Promise<Response> {
  const row = await env.DB.prepare('SELECT photo_id FROM heroes WHERE page = ?')
    .bind(page)
    .first<{ photo_id: string }>();
  return json(row ? { photoId: row.photo_id } : null, env, origin);
}

// PUT /heroes/:page — set or replace the hero for a page
async function handleSetHero(page: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const { photoId } = await request.json<{ photoId: string }>();
  if (!photoId) return json({ error: 'photoId required' }, env, origin, 400);

  await env.DB.prepare(
    `INSERT INTO heroes (page, photo_id) VALUES (?, ?)
     ON CONFLICT(page) DO UPDATE SET photo_id = excluded.photo_id, updated_at = datetime('now')`
  ).bind(page, photoId).run();

  return json({ ok: true, page, photoId }, env, origin);
}

// ── Client galleries ──────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeGalleryToken(galleryId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`gallery:${galleryId}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyGalleryToken(galleryId: string, token: string, secret: string): Promise<boolean> {
  try {
    const expected = await makeGalleryToken(galleryId, secret);
    return expected === token;
  } catch {
    return false;
  }
}

function getGalleryToken(request: Request): string | null {
  const auth = request.headers.get('X-Gallery-Token');
  return auth ?? null;
}

// GET /client-galleries — list all (admin only)
async function handleListClientGalleries(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const { results } = await env.DB.prepare(
    `SELECT cg.id, cg.name, cg.created_at, COUNT(cp.id) as photo_count
     FROM client_galleries cg
     LEFT JOIN client_photos cp ON cp.gallery_id = cg.id
     GROUP BY cg.id ORDER BY cg.created_at DESC`
  ).all<{ id: string; name: string; created_at: string; photo_count: number }>();
  return json(results, env, origin);
}

// POST /client-galleries — create gallery (admin only)
async function handleCreateClientGallery(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const { id, name, password } = await request.json<{ id: string; name: string; password?: string }>();
  if (!id || !name) return json({ error: 'id and name required' }, env, origin, 400);
  if (!/^[a-z0-9-]+$/.test(id)) return json({ error: 'id must be lowercase letters, numbers, hyphens only' }, env, origin, 400);
  const password_hash = password ? await sha256Hex(password) : null;
  try {
    await env.DB.prepare(
      `INSERT INTO client_galleries (id, name, password_hash) VALUES (?, ?, ?)`
    ).bind(id, name, password_hash).run();
  } catch (err) {
    const msg = String(err);
    if (msg.includes('UNIQUE') || msg.includes('already exists')) {
      return json({ error: `The slug "${id}" is already taken — try a different one.` }, env, origin, 409);
    }
    return json({ error: 'Failed to create gallery' }, env, origin, 500);
  }
  return json({ id, name }, env, origin, 201);
}

// DELETE /client-galleries/:id — delete gallery + its photos (admin only)
async function handleDeleteClientGallery(id: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  // Delete CF Images for all photos in this gallery
  const { results } = await env.DB.prepare(`SELECT id FROM client_photos WHERE gallery_id = ?`).bind(id).all<{ id: string }>();
  await Promise.all(results.map(r =>
    fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_IMAGES_ACCOUNT_ID}/images/v1/${r.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}` }
    })
  ));
  await env.DB.prepare(`DELETE FROM client_galleries WHERE id = ?`).bind(id).run();
  return json({ ok: true }, env, origin);
}

// POST /client-galleries/:id/photos — upload photo to client gallery (admin only)
async function handleUploadClientPhoto(galleryId: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const row = await env.DB.prepare(`SELECT id FROM client_galleries WHERE id = ?`).bind(galleryId).first();
  if (!row) return json({ error: 'Gallery not found' }, env, origin, 404);

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return json({ error: 'No file provided' }, env, origin, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) return json({ error: `File type .${ext} not allowed` }, env, origin, 400);

  const imageId = await uploadToCFImages(file, env);
  await env.DB.prepare(`INSERT INTO client_photos (id, gallery_id, filename) VALUES (?, ?, ?)`)
    .bind(imageId, galleryId, file.name).run();

  return json({ id: imageId, filename: file.name }, env, origin, 201);
}

// DELETE /client-galleries/:id/photos/:photoId (admin only)
async function handleDeleteClientPhoto(galleryId: string, photoId: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_IMAGES_ACCOUNT_ID}/images/v1/${photoId}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}` }
  });
  await env.DB.prepare(`DELETE FROM client_photos WHERE id = ? AND gallery_id = ?`).bind(photoId, galleryId).run();
  return json({ ok: true }, env, origin);
}

// POST /client-galleries/:id/verify — verify password, return gallery token (public)
async function handleVerifyClientGallery(id: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  const row = await env.DB.prepare(`SELECT password_hash FROM client_galleries WHERE id = ?`).bind(id).first<{ password_hash: string | null }>();
  if (!row) return json({ error: 'Not found' }, env, origin, 404);
  if (!row.password_hash) {
    // Public gallery — no password needed
    const token = await makeGalleryToken(id, env.UPLOAD_SECRET);
    return json({ token }, env, origin);
  }
  const { password } = await request.json<{ password: string }>();
  const hash = await sha256Hex(password ?? '');
  if (hash !== row.password_hash) return json({ error: 'Wrong password' }, env, origin, 401);
  const token = await makeGalleryToken(id, env.UPLOAD_SECRET);
  return json({ token }, env, origin);
}

// GET /client-galleries/:id/photos — get photos (public if no password, else admin auth OR gallery token)
async function handleGetClientPhotos(id: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  const meta = await env.DB.prepare(`SELECT id, name, password_hash, cover_photo_id FROM client_galleries WHERE id = ?`).bind(id).first<{ id: string; name: string; password_hash: string | null; cover_photo_id: string | null }>();
  if (!meta) return json({ error: 'Not found' }, env, origin, 404);

  if (meta.password_hash) {
    const adminAuth = isAuthorized(request, env);
    const token = getGalleryToken(request);
    if (!adminAuth && (!token || !(await verifyGalleryToken(id, token, env.UPLOAD_SECRET)))) {
      return unauthorized(env, origin);
    }
  }

  const [photosResult, favsResult] = await Promise.all([
    env.DB.prepare(`SELECT id, filename, uploaded_at FROM client_photos WHERE gallery_id = ? ORDER BY uploaded_at DESC`).bind(id).all<{ id: string; filename: string; uploaded_at: string }>(),
    env.DB.prepare(`SELECT photo_id FROM client_photo_favorites WHERE gallery_id = ?`).bind(id).all<{ photo_id: string }>(),
  ]);
  const favoriteIds = new Set(favsResult.results.map(f => f.photo_id));
  const photos = photosResult.results.map(p => ({ ...p, favorited: favoriteIds.has(p.id) }));
  return json({ gallery: { id: meta.id, name: meta.name, cover_photo_id: meta.cover_photo_id }, photos }, env, origin);
}

// POST /client-galleries/:id/photos/:photoId/favorite — toggle favorite (gallery token or open for public)
async function handleToggleFavorite(galleryId: string, photoId: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  const meta = await env.DB.prepare(`SELECT password_hash FROM client_galleries WHERE id = ?`).bind(galleryId).first<{ password_hash: string | null }>();
  if (!meta) return json({ error: 'Not found' }, env, origin, 404);
  if (meta.password_hash) {
    const adminAuth = isAuthorized(request, env);
    const token = getGalleryToken(request);
    if (!adminAuth && (!token || !(await verifyGalleryToken(galleryId, token, env.UPLOAD_SECRET)))) {
      return unauthorized(env, origin);
    }
  }
  const existing = await env.DB.prepare(`SELECT 1 FROM client_photo_favorites WHERE gallery_id = ? AND photo_id = ?`).bind(galleryId, photoId).first();
  if (existing) {
    await env.DB.prepare(`DELETE FROM client_photo_favorites WHERE gallery_id = ? AND photo_id = ?`).bind(galleryId, photoId).run();
    return json({ favorited: false }, env, origin);
  }
  await env.DB.prepare(`INSERT INTO client_photo_favorites (gallery_id, photo_id) VALUES (?, ?)`).bind(galleryId, photoId).run();
  return json({ favorited: true }, env, origin);
}

// PATCH /client-galleries/:id — update name, password, and/or rename slug (admin only)
async function handleUpdateClientGallery(id: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const body = await request.json<{ name?: string; password?: string; newId?: string; coverPhotoId?: string | null }>();

  const existing = await env.DB.prepare(`SELECT id, name FROM client_galleries WHERE id = ?`).bind(id).first<{ id: string; name: string }>();
  if (!existing) return json({ error: 'Not found' }, env, origin, 404);

  const newId = body.newId ?? id;

  if (newId !== id && !/^[a-z0-9-]+$/.test(newId)) {
    return json({ error: 'Slug must be lowercase letters, numbers, hyphens only' }, env, origin, 400);
  }

  const statements: D1PreparedStatement[] = [];

  if (newId !== id) {
    // Rename: copy row with new id, migrate photos, delete old
    statements.push(
      env.DB.prepare(`INSERT INTO client_galleries (id, name, password_hash, created_at) SELECT ?, name, password_hash, created_at FROM client_galleries WHERE id = ?`).bind(newId, id),
      env.DB.prepare(`UPDATE client_photos SET gallery_id = ? WHERE gallery_id = ?`).bind(newId, id),
      env.DB.prepare(`DELETE FROM client_galleries WHERE id = ?`).bind(id),
    );
  }

  if (body.name) {
    statements.push(env.DB.prepare(`UPDATE client_galleries SET name = ? WHERE id = ?`).bind(body.name, newId !== id ? newId : id));
  }
  if (body.password !== undefined) {
    const hash = body.password ? await sha256Hex(body.password) : null;
    statements.push(env.DB.prepare(`UPDATE client_galleries SET password_hash = ? WHERE id = ?`).bind(hash, newId !== id ? newId : id));
  }
  if (body.coverPhotoId !== undefined) {
    const targetId = newId !== id ? newId : id;
    statements.push(env.DB.prepare(`UPDATE client_galleries SET cover_photo_id = ? WHERE id = ?`).bind(body.coverPhotoId, targetId));
  }

  if (statements.length > 0) await env.DB.batch(statements);

  return json({ ok: true, id: newId }, env, origin);
}

// POST /client-galleries/:id/photos/from-portfolio — link portfolio photos into client gallery (admin only)
async function handleAddFromPortfolio(galleryId: string, request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const { imageIds } = await request.json<{ imageIds: string[] }>();
  if (!imageIds?.length) return json({ error: 'imageIds required' }, env, origin, 400);

  // Get filenames from photos table
  const placeholders = imageIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT id, filename FROM photos WHERE id IN (${placeholders})`)
    .bind(...imageIds).all<{ id: string; filename: string }>();

  const existing = new Set(
    (await env.DB.prepare(`SELECT id FROM client_photos WHERE gallery_id = ? AND id IN (${placeholders})`).bind(galleryId, ...imageIds).all<{ id: string }>()).results.map(r => r.id)
  );

  const toInsert = results.filter(r => !existing.has(r.id));
  if (toInsert.length > 0) {
    await env.DB.batch(toInsert.map(r =>
      env.DB.prepare(`INSERT OR IGNORE INTO client_photos (id, gallery_id, filename) VALUES (?, ?, ?)`)
        .bind(r.id, galleryId, r.filename)
    ));
  }

  return json({ added: toInsert.length }, env, origin);
}

// POST /photos/import-from-client — add a client photo into the main portfolio (admin only)
async function handleImportFromClient(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);
  const body = await request.json<{ imageId: string; filename: string; galleries?: string[]; ratio?: string; title?: string; alt?: string; featured?: boolean }>();
  if (!body.imageId || !body.filename) return json({ error: 'imageId and filename required' }, env, origin, 400);

  const year = new Date().getFullYear();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO photos (id, filename, galleries, ratio, title, alt, year, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.imageId,
    body.filename,
    JSON.stringify(body.galleries ?? ['uncategorized']),
    body.ratio ?? 'tall',
    body.title ?? '',
    body.alt ?? '',
    year,
    body.featured ? 1 : 0,
  ).run();

  return json({ ok: true }, env, origin);
}

// ── Redeploy ──────────────────────────────────────────────────────────────────

// POST /redeploy — triggers the deploy-photos GitHub Actions workflow
async function handleRedeploy(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env, origin);

  const res = await fetch(
    'https://api.github.com/repos/JuanRamirez2000/portfolio/actions/workflows/deploy-photos.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'portfolio-photos-worker',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return json({ error: `GitHub dispatch failed: ${err}` }, env, origin, 502);
  }

  return json({ ok: true }, env, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { method } = request;
    const pathname = url.pathname;
    const origin = request.headers.get('Origin');

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env, origin) });
    }

    if (method === 'POST'  && pathname === '/upload')               return handleUpload(request, env, origin);
    if (method === 'POST'  && pathname === '/redeploy')             return handleRedeploy(request, env, origin);
    if (method === 'POST'  && pathname === '/photos/import-from-client') return handleImportFromClient(request, env, origin);
    if (method === 'GET'   && pathname === '/photos')               return handleGetPhotos(request, env, origin);
    if (method === 'GET'   && pathname === '/galleries')            return handleGetGalleries(env, origin);

    const photoMatch = pathname.match(/^\/photos\/([^/]+)$/);
    if (photoMatch) {
      const id = photoMatch[1];
      if (method === 'PATCH')  return handleUpdatePhoto(id, request, env, origin);
      if (method === 'DELETE') return handleDeletePhoto(id, request, env, origin);
    }

    const heroMatch = pathname.match(/^\/heroes\/([^/]+)$/);
    if (heroMatch) {
      const page = heroMatch[1];
      if (method === 'GET') return handleGetHero(page, env, origin);
      if (method === 'PUT') return handleSetHero(page, request, env, origin);
    }

    // Client galleries
    if (method === 'GET'  && pathname === '/client-galleries') return handleListClientGalleries(request, env, origin);
    if (method === 'POST' && pathname === '/client-galleries') return handleCreateClientGallery(request, env, origin);

    const cgMatch = pathname.match(/^\/client-galleries\/([^/]+)$/);
    if (cgMatch) {
      const id = cgMatch[1];
      if (method === 'DELETE') return handleDeleteClientGallery(id, request, env, origin);
      if (method === 'PATCH')  return handleUpdateClientGallery(id, request, env, origin);
    }

    const cgPhotosMatch = pathname.match(/^\/client-galleries\/([^/]+)\/photos$/);
    if (cgPhotosMatch) {
      const id = cgPhotosMatch[1];
      if (method === 'POST') return handleUploadClientPhoto(id, request, env, origin);
      if (method === 'GET')  return handleGetClientPhotos(id, request, env, origin);
    }

    const cgFromPortfolioMatch = pathname.match(/^\/client-galleries\/([^/]+)\/photos\/from-portfolio$/);
    if (cgFromPortfolioMatch) {
      const id = cgFromPortfolioMatch[1];
      if (method === 'POST') return handleAddFromPortfolio(id, request, env, origin);
    }

    const cgPhotoFavMatch = pathname.match(/^\/client-galleries\/([^/]+)\/photos\/([^/]+)\/favorite$/);
    if (cgPhotoFavMatch) {
      const [, galleryId, photoId] = cgPhotoFavMatch;
      if (method === 'POST') return handleToggleFavorite(galleryId, photoId, request, env, origin);
    }

    const cgPhotoMatch = pathname.match(/^\/client-galleries\/([^/]+)\/photos\/([^/]+)$/);
    if (cgPhotoMatch) {
      const [, galleryId, photoId] = cgPhotoMatch;
      if (method === 'DELETE') return handleDeleteClientPhoto(galleryId, photoId, request, env, origin);
    }

    const cgVerifyMatch = pathname.match(/^\/client-galleries\/([^/]+)\/verify$/);
    if (cgVerifyMatch) {
      const id = cgVerifyMatch[1];
      if (method === 'POST') return handleVerifyClientGallery(id, request, env, origin);
    }

    return json({ error: 'Not found' }, env, origin, 404);
  },
};
