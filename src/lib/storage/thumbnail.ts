'use client';

/** Creates a small JPEG preview in-browser for responsive chat thumbnails and offline caches. */
export async function createImageThumbnail(file: File, maxDimension = 480): Promise<Blob | null> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap === 'undefined') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return null; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.76));
  } catch {
    return null;
  }
}
