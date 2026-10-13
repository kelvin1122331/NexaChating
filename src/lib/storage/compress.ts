'use client';

/** Resizes a browser image to fit the upload budget without modifying animated or vector assets. */
export async function compressImage(file: File, maxDimension = 2048, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || ['image/gif', 'image/svg+xml', 'image/avif'].includes(file.type)) return file;
  if (typeof createImageBitmap === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2_000_000) { bitmap.close(); return file; }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: file.type !== 'image/jpeg' });
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
    if (!blob || blob.size >= file.size) return file;
    const extension = outputType === 'image/png' ? 'png' : 'jpg';
    const safeName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${safeName}.${extension}`, { type: outputType, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
