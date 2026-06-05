import type { Ratio } from './cf-images';

// Approximate natural dimensions per ratio — prevents layout shift before images load
export const RATIO_DIMS: Record<Ratio, { width: number; height: number }> = {
  tall:   { width: 400, height: 533 },
  wide:   { width: 400, height: 300 },
  square: { width: 400, height: 400 },
};

export const GALLERY_LABELS: Record<string, string> = {
  portraits: 'Portraits',
  landscape: 'Landscape',
  grad: 'Grad',
  boudoir: 'Boudoir',
};
