const ACCOUNT_HASH = import.meta.env.VITE_CF_ACCOUNT_HASH ?? '';

export type Variant = 'thumbnail' | 'gallery' | 'hero';

export function cfImageUrl(id: string, variant: Variant = 'thumbnail'): string {
  if (!ACCOUNT_HASH) return '';
  return `https://imagedelivery.net/${ACCOUNT_HASH}/${id}/${variant}`;
}
