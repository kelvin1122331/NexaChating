import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';
import { MAX_MEDIA_BYTES, mediaExtensionForMime, MEDIA_BUCKET, removeUploadedMedia, type UploadedMedia, validateAndPrepareMedia } from '@/lib/server/media';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  path: z.string().min(1).max(512),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().toLowerCase().max(120),
  fileSize: z.number().int().min(1).max(MAX_MEDIA_BYTES),
  conversationId: z.string().uuid().nullable().optional(),
  messageId: z.string().uuid().nullable().optional(),
}).strict().superRefine((body, context) => {
  if (body.messageId && !body.conversationId) context.addIssue({ code: 'custom', message: 'A message upload requires a conversation ID.' });
});

/** Validates a signed-upload object before creating an RLS-visible media record and thumbnail. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 20, windowSeconds: 60, namespace: 'media-complete' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = requestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The uploaded media details are invalid.', 'INVALID_REQUEST');
  const input = parsed.data;
  const extension = mediaExtensionForMime(input.mimeType);
  if (!extension) return apiError(415, 'This file type is not supported.', 'MEDIA_TYPE_NOT_ALLOWED');
  const folder = input.conversationId ?? 'private';
  const expectedPath = new RegExp(`^${authorization.context.user.id}/${folder}/[0-9a-f-]{36}\\.${extension}$`, 'i');
  if (!expectedPath.test(input.path) || input.path.includes('..')) return apiError(403, 'The upload path is not allowed.', 'UPLOAD_PATH_REJECTED');
  if (input.conversationId && !await requireConversationMembership(authorization.context, input.conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }

  const messageId = input.messageId ?? null;
  let conversationId = input.conversationId ?? null;
  if (messageId) {
    const { data: message, error } = await authorization.context.supabase.from('messages')
      .select('id,conversation_id,sender_id').eq('id', messageId).maybeSingle();
    if (error || !message) return apiError(404, 'Message not found.', 'MESSAGE_NOT_FOUND');
    if (message.sender_id !== authorization.context.user.id) return apiError(403, 'Only the sender can attach media to this message.', 'MEDIA_ATTACH_NOT_ALLOWED');
    if (conversationId && message.conversation_id !== conversationId) return apiError(400, 'The message does not belong to this conversation.', 'INVALID_REQUEST');
    conversationId = message.conversation_id;
    if (folder !== conversationId) return apiError(403, 'The upload path does not match the message conversation.', 'UPLOAD_PATH_REJECTED');
  }

  const { data: blob, error: downloadError } = await authorization.context.supabase.storage.from(MEDIA_BUCKET).download(input.path);
  if (downloadError || !blob) return apiError(404, 'The uploaded file was not found.', 'UPLOAD_NOT_FOUND');
  if (blob.size !== input.fileSize || blob.size > MAX_MEDIA_BYTES) return apiError(413, 'The uploaded file size did not match the request.', 'MEDIA_SIZE_INVALID');

  let prepared: UploadedMedia;
  try {
    const file = new File([await blob.arrayBuffer()], input.fileName, { type: input.mimeType });
    prepared = await validateAndPrepareMedia(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MEDIA_SIZE_INVALID') return apiError(413, 'File size must be between 1 byte and 100 MB.', 'MEDIA_SIZE_INVALID');
    if (message === 'MEDIA_TYPE_NOT_ALLOWED') return apiError(415, 'This file type is not supported.', 'MEDIA_TYPE_NOT_ALLOWED');
    return apiError(422, 'The uploaded file is invalid or could not be decoded.', 'MEDIA_INVALID');
  }
  const thumbnailPath = prepared.thumbnailBuffer ? `${input.path.slice(0, input.path.lastIndexOf('/'))}/thumbnail.webp` : null;
  if (thumbnailPath && prepared.thumbnailBuffer) {
    const { error } = await authorization.context.supabase.storage.from(MEDIA_BUCKET).upload(thumbnailPath, prepared.thumbnailBuffer, {
      contentType: 'image/webp', cacheControl: '3600', upsert: false,
    });
    if (error) {
      await authorization.context.supabase.storage.from(MEDIA_BUCKET).remove([input.path]);
      console.warn('[NexaChat media] Thumbnail upload failed.', error.message);
      return apiError(503, 'The media thumbnail could not be saved.', 'THUMBNAIL_SAVE_FAILED');
    }
  }

  const fileName = input.fileName.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\p{L}\p{N}._ -]/gu, '_').trim().slice(0, 100) || `upload.${extension}`;
  const { data, error } = await authorization.context.supabase.from('media').insert({
    message_id: messageId,
    uploader_id: authorization.context.user.id,
    bucket: MEDIA_BUCKET,
    file_path: input.path,
    file_name: fileName,
    file_size: blob.size,
    mime_type: input.mimeType,
    width: prepared.width,
    height: prepared.height,
    waveform: [],
    thumbnail_path: thumbnailPath,
    is_encrypted: false,
  }).select('id,message_id,bucket,file_path,file_name,file_size,mime_type,width,height,duration,thumbnail_path,created_at').single();
  if (error || !data) {
    if (thumbnailPath) await removeUploadedMedia(authorization.context.supabase, {
      ...prepared,
      filePath: input.path,
      thumbnailPath,
      bucket: MEDIA_BUCKET,
      originalBuffer: Buffer.alloc(0),
      thumbnailBuffer: null,
    });
    else await authorization.context.supabase.storage.from(MEDIA_BUCKET).remove([input.path]);
    console.warn('[NexaChat media] Signed upload metadata could not be saved.', error?.code);
    return apiError(500, 'The upload could not be saved.', 'MEDIA_METADATA_FAILED');
  }
  return Response.json({ media: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
