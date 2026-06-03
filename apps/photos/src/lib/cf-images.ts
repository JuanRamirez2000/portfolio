// Cloudflare Images URL builder.
//
// Account hash lives in PUBLIC_CF_IMAGES_ACCOUNT_HASH (embedded at build time).
// Image IDs come from photos.json — obtained when you upload via the CF dashboard
// or API.  Variants are defined once in your CF Images settings; the names below
// must match what you create there.
//
// URL shape: https://imagedelivery.net/<accountHash>/<imageId>/<variant>

const ACCOUNT_HASH = import.meta.env.PUBLIC_CF_IMAGES_ACCOUNT_HASH ?? '';

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

export type CfVariant =
  | 'thumbnail'   // ~400px wide  — masonry grid cells
  | 'gallery'     // ~1200px wide — lightbox / full view
  | 'hero'        // ~1920px wide — full-bleed header
  | 'public';     // original, unmodified (use sparingly)

export function cfImageUrl(imageId: string, variant: CfVariant = 'gallery'): string {
  if (!ACCOUNT_HASH) {
    // Falls back to a visible broken-image during local dev before CF is wired up
    return '';
  }
  return `https://imagedelivery.net/${ACCOUNT_HASH}/${imageId}/${variant}`;
}

// srcset helper: gives the browser two candidates so it picks the right size
export function cfImageSrcset(imageId: string): string {
  return [
    `${cfImageUrl(imageId, 'thumbnail')} 400w`,
    `${cfImageUrl(imageId, 'gallery')} 1200w`,
  ].join(', ');
}

// Hero srcset: serves gallery at 1200w and hero at 2560w for retina full-bleed
export function cfHeroSrcset(imageId: string): string {
  return [
    `${cfImageUrl(imageId, 'gallery')} 1200w`,
    `${cfImageUrl(imageId, 'hero')} 2560w`,
  ].join(', ');
}
