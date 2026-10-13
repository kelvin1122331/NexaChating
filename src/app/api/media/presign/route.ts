import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';
import { createMediaObjectPath, MAX_MEDIA_BYTES, mediaExtensionForMime, MEDIA_BUCKET } from '@/lib/server/media';

const requestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().toLowerCase().max(120),
  fileSize: z.number().int().min(1).max(MAX_MEDIA_BYTES),
  conversationId: z.string().uuid().nullable().optional(),
}).strict();

/** Issues a short-lived, user-folder-scoped upload token after validating type, size, and membership. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 20, windowSeconds: 60, namespace: 'media-presign' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = requestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The upload request is invalid.', 'INVALID_REQUEST');
  const { fileName, mimeType, fileSize, conversationId } = parsed.data;
  if (!mediaExtensionForMime(mimeType)) return apiError(415, 'This file type is not supported.', 'MEDIA_TYPE_NOT_ALLOWED');
  if (conversationId && !await requireConversationMembership(authorization.context, conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  const path = createMediaObjectPath(authorization.context.user.id, conversationId ?? null, mimeType);
  if (!path) return apiError(415, 'This file type is not supported.', 'MEDIA_TYPE_NOT_ALLOWED');
  const { data, error } = await authorization.context.supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    console.warn('[NexaChat media] Signed upload token could not be created.', error?.message);
    return apiError(503, 'The upload could not be prepared.', 'MEDIA_UPLOAD_UNAVAILABLE');
  }
  return Response.json({
    bucket: MEDIA_BUCKET,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName: fileName.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100),
    mimeType,
    fileSize,
  }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
