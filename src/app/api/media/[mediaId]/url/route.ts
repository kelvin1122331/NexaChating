import { z } from 'zod';
import { apiError, authorizeApiRequest } from '@/lib/server/api';

const uuidSchema = z.string().uuid();

/** Returns short-lived signed URLs only after the media row's RLS visibility has been confirmed. */
export async function GET(request: Request, context: { params: Promise<{ mediaId: string }> }): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 120, windowSeconds: 60, namespace: 'media-url' },
  });
  if (!authorization.ok) return authorization.response;
  const { mediaId: rawId } = await context.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return apiError(400, 'The media ID is invalid.', 'INVALID_MEDIA_ID');
  const { data: media, error: mediaError } = await authorization.context.supabase.from('media')
    .select('bucket,file_path,thumbnail_path,mime_type')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (mediaError || !media) return apiError(404, 'Media not found.', 'MEDIA_NOT_FOUND');

  const storage = authorization.context.supabase.storage.from(media.bucket);
  const [original, thumbnail] = await Promise.all([
    storage.createSignedUrl(media.file_path, 60),
    media.thumbnail_path ? storage.createSignedUrl(media.thumbnail_path, 60) : Promise.resolve({ data: null, error: null }),
  ]);
  if (original.error || !original.data) {
    console.warn('[NexaChat media] Signed read URL could not be created.', original.error?.message);
    return apiError(503, 'The media is temporarily unavailable.', 'MEDIA_URL_UNAVAILABLE');
  }
  return Response.json({
    url: original.data.signedUrl,
    thumbnailUrl: thumbnail.data?.signedUrl ?? null,
    mimeType: media.mime_type,
    expiresInSeconds: 60,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
