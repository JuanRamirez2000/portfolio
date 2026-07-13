import { getToken } from './auth';

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? '';

export type Ratio = 'tall' | 'wide' | 'square';

export interface Photo {
  id: string;
  filename: string;
  galleries: string[];
  ratio: Ratio;
  title: string;
  alt: string;
  year: number;
  featured: boolean;
  uploaded_at: string;
}

export interface PhotoMeta {
  title?: string;
  alt?: string;
  ratio?: Ratio;
  galleries?: string[];
  featured?: boolean;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function checkAuth(res: Response): Promise<Response> {
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  return res;
}

async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    throw new Error(json.error ?? text);
  } catch {
    throw new Error(text);
  }
}

export async function getPhotos(): Promise<Photo[]> {
  const res = await fetch(`${WORKER_URL}/photos`);
  if (!res.ok) throw new Error('Failed to fetch photos');
  return res.json();
}

export async function uploadPhoto(file: File, meta: PhotoMeta): Promise<Photo> {
  const form = new FormData();
  form.append('file', file);
  form.append('galleries', JSON.stringify(meta.galleries ?? ['uncategorized']));
  form.append('ratio', meta.ratio ?? 'tall');
  form.append('title', meta.title ?? '');
  form.append('alt', meta.alt ?? '');
  form.append('year', String(new Date().getFullYear()));
  form.append('featured', String(meta.featured ?? false));

  const res = await checkAuth(
    await fetch(`${WORKER_URL}/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updatePhoto(id: string, meta: PhotoMeta): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(meta),
    })
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function deletePhoto(id: string): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/photos/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  );
  if (!res.ok) throw new Error(await res.text());
}

export type HeroPage = 'landing' | 'portraits' | 'landscape' | 'grad' | 'boudoir';

export async function getHero(page: HeroPage): Promise<string | null> {
  const res = await fetch(`${WORKER_URL}/heroes/${page}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { photoId: string } | null;
  return data?.photoId ?? null;
}

export async function redeploy(): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/redeploy`, {
      method: 'POST',
      headers: authHeaders(),
    })
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function setHero(page: HeroPage, photoId: string): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/heroes/${page}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ photoId }),
    })
  );
  if (!res.ok) throw new Error(await res.text());
}

// ── Client galleries ──────────────────────────────────────────────────────────

export interface ClientGallery {
  id: string;
  name: string;
  created_at: string;
  photo_count: number;
}

export interface ClientPhoto {
  id: string;
  filename: string;
  uploaded_at: string;
}

export async function listClientGalleries(): Promise<ClientGallery[]> {
  const res = await checkAuth(await fetch(`${WORKER_URL}/client-galleries`, { headers: authHeaders() }));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createClientGallery(id: string, name: string, password: string): Promise<ClientGallery> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, name, password: password || undefined }),
    })
  );
  await throwIfError(res);
  return res.json();
}

export async function deleteClientGallery(id: string): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries/${id}`, { method: 'DELETE', headers: authHeaders() })
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function uploadClientPhoto(galleryId: string, file: File): Promise<ClientPhoto> {
  const form = new FormData();
  form.append('file', file);
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries/${galleryId}/photos`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteClientPhoto(galleryId: string, photoId: string): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries/${galleryId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function getClientPhotos(galleryId: string): Promise<{ gallery: ClientGallery; photos: ClientPhoto[] }> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries/${galleryId}/photos`, { headers: authHeaders() })
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateClientGallery(id: string, updates: { name?: string; password?: string | null; newId?: string }): Promise<{ id: string }> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updates),
    })
  );
  await throwIfError(res);
  return res.json();
}

export async function addFromPortfolio(galleryId: string, imageIds: string[]): Promise<{ added: number }> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/client-galleries/${galleryId}/photos/from-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ imageIds }),
    })
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importToPortfolio(imageId: string, filename: string, meta: PhotoMeta): Promise<void> {
  const res = await checkAuth(
    await fetch(`${WORKER_URL}/photos/import-from-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ imageId, filename, ...meta }),
    })
  );
  if (!res.ok) throw new Error(await res.text());
}
