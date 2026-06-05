export const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

export async function getImageRatio(filePath) {
  try {
    const { imageSize } = await import('image-size');
    const { width, height } = imageSize(filePath);
    if (!width || !height) return 'tall';
    const ratio = width / height;
    if (ratio > 1.2)  return 'wide';
    if (ratio < 0.85) return 'tall';
    return 'square';
  } catch {
    return 'tall';
  }
}
