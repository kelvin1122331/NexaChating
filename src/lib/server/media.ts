import 'server-only';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export const MEDIA_BUCKET = 'chat-media';
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/wav': 'wav',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

export interface UploadedMedia {
  bucket: string;
  filePath: string;
  thumbnailPath: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  originalBuffer: Buffer;
  thumbnailBuffer: Buffer | null;
}

/** Returns a validated file extension or null for MIME types not accepted by the private media bucket. */
export function mediaExtensionForMime(mimeType: string): string | null {
  return MIME_EXTENSIONS[mimeType.toLowerCase()] ?? null;
}

/** Creates an unpredictable object key nested under the uploader's Storage RLS folder. */
export function createMediaObjectPath(userId: string, conversationId: string | null, mimeType: string): string | null {
  const extension = mediaExtensionForMime(mimeType);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!extension || !uuidPattern.test(userId) || (conversationId !== null && !uuidPattern.test(conversationId))) return null;
  return `${userId}/${conversationId ?? 'private'}/${crypto.randomUUID()}.${extension}`;
}

/** Checks file signatures and decodability rather than trusting the browser-supplied MIME type. */
export async function validateAndPrepareMedia(file: File): Promise<UploadedMedia> {
  if (file.size < 1 || file.size > MAX_MEDIA_BYTES) throw new Error('MEDIA_SIZE_INVALID');
  const mimeType = file.type.toLowerCase();
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  const fileName = sanitizeFileName(file.name, extension);
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  if (originalBuffer.byteLength !== file.size) throw new Error('MEDIA_SIZE_INVALID');

  let width: number | null = null;
  let height: number | null = null;
  let thumbnailBuffer: Buffer | null = null;
  if (mimeType.startsWith('image/')) {
    try {
      const metadata = await sharp(originalBuffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' }).metadata();
      if (!metadata.format || !isMatchingImageFormat(mimeType, metadata.format)) throw new Error('MEDIA_SIGNATURE_INVALID');
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new Error('MEDIA_DIMENSIONS_INVALID');
      width = metadata.width;
      height = metadata.height;
      thumbnailBuffer = await sharp(originalBuffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
        .rotate()
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('MEDIA_')) throw error;
      throw new Error('MEDIA_IMAGE_INVALID');
    }
  } else {
    validateFileSignature(mimeType, originalBuffer);
  }

  const storageId = crypto.randomUUID();
  const folder = `${storageId.slice(0, 2)}/${storageId}`;
  const filePath = `${folder}/original.${extension}`;
  const thumbnailPath = thumbnailBuffer ? `${folder}/thumbnail.webp` : null;
  return { bucket: MEDIA_BUCKET, filePath, thumbnailPath, fileName, fileSize: file.size, mimeType, width, height, originalBuffer, thumbnailBuffer };
}

/** Uploads validated content into the private bucket; callers must persist a media row before reads are allowed. */
export async function uploadPreparedMedia(
  supabase: SupabaseClient<Database>,
  userId: string,
  conversationId: string | null,
  prepared: UploadedMedia,
): Promise<UploadedMedia> {
  const folder = `${userId}/${conversationId ?? 'private'}/${prepared.filePath}`;
  const filePath = folder;
  const thumbnailPath = prepared.thumbnailPath ? `${userId}/${conversationId ?? 'private'}/${prepared.thumbnailPath}` : null;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(filePath, prepared.originalBuffer, {
    contentType: prepared.mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw new Error(`MEDIA_UPLOAD_FAILED:${uploadError.message}`);
  if (thumbnailPath && prepared.thumbnailBuffer) {
    const { error: thumbnailError } = await supabase.storage.from(MEDIA_BUCKET).upload(thumbnailPath, prepared.thumbnailBuffer, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false,
    });
    if (thumbnailError) {
      await supabase.storage.from(MEDIA_BUCKET).remove([filePath]);
      throw new Error(`MEDIA_UPLOAD_FAILED:${thumbnailError.message}`);
    }
  }
  return { ...prepared, filePath, thumbnailPath };
}

/** Removes uploaded original and thumbnail objects after a failed database write. */
export async function removeUploadedMedia(supabase: SupabaseClient<Database>, media: UploadedMedia): Promise<void> {
  const paths = [media.filePath, media.thumbnailPath].filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (error) console.error('[NexaChat media] Storage cleanup failed.', error.message);
  }
}

export function messageTypeForMime(mimeType: string): Database['public']['Enums']['message_type'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function sanitizeFileName(name: string, fallbackExtension: string): string {
  const basename = name.split(/[\\/]/).pop() ?? '';
  const safe = basename.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\p{L}\p{N}._ -]/gu, '_').trim().slice(0, 100);
  return safe || `upload.${fallbackExtension}`;
}

function isMatchingImageFormat(mimeType: string, format: string): boolean {
  const expected: Record<string, string[]> = {
    'image/jpeg': ['jpeg', 'jpg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'],
  };
  return expected[mimeType]?.includes(format) ?? false;
}

function validateFileSignature(mimeType: string, buffer: Buffer): void {
  const starts = (signature: number[]): boolean => signature.every((byte, index) => buffer[index] === byte);
  let valid = false;
  if (mimeType === 'application/pdf') valid = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  else if (mimeType === 'video/mp4' || mimeType === 'audio/mp4') valid = buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  else if (mimeType === 'video/webm' || mimeType === 'audio/webm') valid = starts([0x1a, 0x45, 0xdf, 0xa3]);
  else if (mimeType === 'audio/wav') valid = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
  else if (mimeType === 'audio/ogg') valid = buffer.subarray(0, 4).toString('ascii') === 'OggS';
  else if (mimeType === 'audio/mpeg') valid = buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  else if (mimeType === 'application/zip' || mimeType.startsWith('application/vnd.openxmlformats-officedocument.')) {
    valid = starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06]) || starts([0x50, 0x4b, 0x07, 0x08]);
  } else if (mimeType === 'text/plain') {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      valid = !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
    } catch { valid = false; }
  }
  if (!valid) throw new Error('MEDIA_SIGNATURE_INVALID');
}
