import { z } from 'zod';
import { apiError, authorizeApiRequest, requireConversationMembership } from '@/lib/server/api';
import { removeUploadedMedia, uploadPreparedMedia, validateAndPrepareMedia, type UploadedMedia } from '@/lib/server/media';

export const runtime = 'nodejs';
export const maxDuration = 60;

const optionalUuidSchema = z.string().uuid();

/** Validates and stores one private media object, optionally attaching it to an existing message. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 20, windowSeconds: 60, namespace: 'media-upload' },
  });
  if (!authorization.ok) return authorization.response;

  let file: File | null = null;
  let conversationId: string | null = null;
  let messageId: string | null = null;
  try {
    const form = await request.formData();
    const fileEntry = form.get('file');
    if (typeof File === 'undefined' || !(fileEntry instanceof File)) return apiError(400, 'Choose a file to upload.', 'FILE_REQUIRED');
    file = fileEntry;
    const rawConversationId = form.get('conversationId');
    const rawMessageId = form.get('messageId');
    if (rawConversationId) {
      const result = optionalUuidSchema.safeParse(rawConversationId);
      if (!result.success) return apiError(400, 'The conversation ID is invalid.', 'INVALID_REQUEST');
      conversationId = result.data;
    }
    if (rawMessageId) {
      const result = optionalUuidSchema.safeParse(rawMessageId);
      if (!result.success) return apiError(400, 'The message ID is invalid.', 'INVALID_REQUEST');
      messageId = result.data;
    }
  } catch {
    return apiError(400, 'The upload request could not be read.', 'INVALID_REQUEST');
  }

  if (!file) return apiError(400, 'Choose a file to upload.', 'FILE_REQUIRED');
  if (conversationId && !await requireConversationMembership(authorization.context, conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  if (messageId) {
    const { data: message, error } = await authorization.context.supabase.from('messages')
      .select('id,conversation_id,sender_id').eq('id', messageId).maybeSingle();
    if (error || !message) return apiError(404, 'Message not found.', 'MESSAGE_NOT_FOUND');
    if (message.sender_id !== authorization.context.user.id) return apiError(403, 'Only the sender can attach media to this message.', 'MEDIA_ATTACH_NOT_ALLOWED');
    if (conversationId && message.conversation_id !== conversationId) return apiError(400, 'The message does not belong to this conversation.', 'INVALID_REQUEST');
    conversationId = message.conversation_id;
  }

  let uploaded: UploadedMedia | null = null;
  try {
    const prepared = await validateAndPrepareMedia(file);
    uploaded = await uploadPreparedMedia(authorization.context.supabase, authorization.context.user.id, conversationId, prepared);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MEDIA_SIZE_INVALID') return apiError(413, 'File size must be between 1 byte and 100 MB.', 'MEDIA_SIZE_INVALID');
    if (message === 'MEDIA_TYPE_NOT_ALLOWED') return apiError(415, 'This file type is not supported.', 'MEDIA_TYPE_NOT_ALLOWED');
    if (message.startsWith('MEDIA_SIGNATURE') || message.startsWith('MEDIA_IMAGE') || message.startsWith('MEDIA_DIMENSIONS')) {
      return apiError(422, 'The uploaded file is invalid or could not be decoded.', 'MEDIA_INVALID');
    }
    console.error('[NexaChat media] Upload failed.', message);
    return apiError(503, 'The file could not be uploaded.', 'MEDIA_UPLOAD_FAILED');
  }

  const { data, error } = await authorization.context.supabase.from('media').insert({
    message_id: messageId,
    uploader_id: authorization.context.user.id,
    bucket: uploaded.bucket,
    file_path: uploaded.filePath,
    file_name: uploaded.fileName,
    file_size: uploaded.fileSize,
    mime_type: uploaded.mimeType,
    width: uploaded.width,
    height: uploaded.height,
    waveform: [],
    thumbnail_path: uploaded.thumbnailPath,
    is_encrypted: false,
  }).select('id,message_id,bucket,file_path,file_name,file_size,mime_type,width,height,duration,thumbnail_path,created_at').single();
  if (error || !data) {
    await removeUploadedMedia(authorization.context.supabase, uploaded);
    console.warn('[NexaChat media] Media metadata insert failed.', error?.code);
    return apiError(500, 'The upload could not be saved.', 'MEDIA_METADATA_FAILED');
  }
  return Response.json({ media: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
