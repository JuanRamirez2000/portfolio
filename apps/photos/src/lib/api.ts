import type { Photo } from './cf-images';

const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL ?? '';

export interface Gallery {
  slug: string;
  name: string;
  tagline: string;
  count: number;
  ageGated: boolean;
}

async function workerFetch<T>(path: string): Promise<T> {
  if (!WORKER_URL) throw new Error('PUBLIC_WORKER_URL is not set');
  const res = await fetch(`${WORKER_URL}${path}`);
  if (!res.ok) throw new Error(`Worker API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function getPhotos(gallery?: string): Promise<Photo[]> {
  const qs = gallery ? `?gallery=${gallery}` : '';
  return workerFetch<Photo[]>(`/photos${qs}`);
}

export async function getFeaturedPhotos(): Promise<Photo[]> {
  return workerFetch<Photo[]>('/photos?featured=true');
}

export async function getGalleries(): Promise<Gallery[]> {
  return workerFetch<Gallery[]>('/galleries');
}

export async function getHero(page: string): Promise<string | null> {
  const res = await workerFetch<{ photoId: string } | null>(`/heroes/${page}`);
  return res?.photoId ?? null;
}
