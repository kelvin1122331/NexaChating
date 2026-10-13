import { z } from 'zod';
import { apiError, authorizeApiRequest, requireConversationMembership } from '@/lib/server/api';
import { sendMessageSchema, type SendMessageInput } from '@/lib/types/api';
import { messageTypeForMime, removeUploadedMedia, uploadPreparedMedia, validateAndPrepareMedia, type UploadedMedia } from '@/lib/server/media';
import type { Database } from '@/lib/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

const formSchema = sendMessageSchema.extend({
  content: z.string().trim().max(20_000).default(''),
}).strict();

/** Sends a text or validated file message into a conversation the caller actively belongs to. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 60, windowSeconds: 60, namespace: 'message-send' },
  });
  if (!authorization.ok) return authorization.response;

  const isMultipart = request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data') ?? false;
  let parsed: SendMessageInput;
  let file: File | null = null;
  try {
    if (isMultipart) {
      const form = await request.formData();
      const value = form.get('file');
      if (value !== null) {
        if (typeof File === 'undefined' || !(value instanceof File)) return apiError(400, 'The uploaded file is invalid.', 'INVALID_FILE');
        file = value;
      }
      const candidate = formSchema.safeParse({
        conversationId: form.get('conversationId'),
        content: form.get('content') ?? '',
        replyToId: form.get('replyToId') || undefined,
        clientMessageId: form.get('clientMessageId') || undefined,
      });
      if (!candidate.success) return apiError(400, 'The message request is invalid.', 'INVALID_REQUEST');
      parsed = candidate.data;
      if (!parsed.content && !file) return apiError(400, 'Add message text or attach a file.', 'EMPTY_MESSAGE');
    } else {
      const body: unknown = await request.json().catch(() => null);
      const candidate = sendMessageSchema.safeParse(body);
      if (!candidate.success) return apiError(400, 'The message request is invalid.', 'INVALID_REQUEST');
      parsed = candidate.data;
    }
  } catch {
    return apiError(400, 'The message request could not be read.', 'INVALID_REQUEST');
  }

  if (!await requireConversationMembership(authorization.context, parsed.conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  if (parsed.replyToId) {
    const { data: reply, error } = await authorization.context.supabase
      .from('messages').select('id')
      .eq('id', parsed.replyToId)
      .eq('conversation_id', parsed.conversationId)
      .maybeSingle();
    if (error || !reply) return apiError(404, 'The reply target was not found.', 'REPLY_NOT_FOUND');
  }

  const messageId = parsed.clientMessageId ?? crypto.randomUUID();
  const { data: duplicate, error: duplicateError } = await authorization.context.supabase
    .from('messages').select('id,conversation_id,sender_id,content,type,metadata,created_at,status')
    .eq('id', messageId)
    .maybeSingle();
  if (!duplicateError && duplicate) {
    if (duplicate.conversation_id === parsed.conversationId && duplicate.sender_id === authorization.context.user.id) {
      return Response.json({ message: duplicate, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return apiError(409, 'This message ID has already been used.', 'MESSAGE_ID_CONFLICT');
  }

  let uploaded: UploadedMedia | null = null;
  try {
    if (file) {
      const prepared = await validateAndPrepareMedia(file);
      uploaded = await uploadPreparedMedia(authorization.context.supabase, authorization.context.user.id, parsed.conversationId, prepared);
    }
  } catch (error) {
    if (uploaded) await removeUploadedMedia(authorization.context.supabase, uploaded);
    const message = error instanceof Error ? error.message : '';
    if (message === 'MEDIA_SIZE_INVALID') return apiError(413, 'File size must be between 1 byte and 100 MB.', 'MEDIA_SIZE_INVALID');
    if (message === 'MEDIA_TYPE_NOT_ALLOWED') return apiError(415, 'This file type is not supported.', 'MEDIA_TYPE_NOT_ALLOWED');
    if (message.startsWith('MEDIA_SIGNATURE') || message.startsWith('MEDIA_IMAGE') || message.startsWith('MEDIA_DIMENSIONS')) {
      return apiError(422, 'The uploaded file is invalid or could not be decoded.', 'MEDIA_INVALID');
    }
    console.error('[NexaChat messages] Media upload failed.', message);
    return apiError(503, 'The file could not be uploaded.', 'MEDIA_UPLOAD_FAILED');
  }

  const type: Database['public']['Enums']['message_type'] = uploaded ? messageTypeForMime(uploaded.mimeType) : 'text';
  const metadata = uploaded ? {
    mediaId: crypto.randomUUID(),
    bucket: uploaded.bucket,
    filePath: uploaded.filePath,
    thumbnailPath: uploaded.thumbnailPath,
    fileName: uploaded.fileName,
    fileSize: uploaded.fileSize,
    mimeType: uploaded.mimeType,
    width: uploaded.width,
    height: uploaded.height,
  } : {};
  const { data: message, error: insertError } = await authorization.context.supabase.from('messages').insert({
    id: messageId,
    conversation_id: parsed.conversationId,
    sender_id: authorization.context.user.id,
    type,
    content: parsed.content || null,
    metadata,
    reply_to_id: parsed.replyToId ?? null,
    status: 'sent',
  }).select('id,conversation_id,sender_id,type,content,metadata,reply_to_id,status,created_at,updated_at').single();

  if (insertError || !message) {
    if (uploaded) await removeUploadedMedia(authorization.context.supabase, uploaded);
    console.warn('[NexaChat messages] Message insert was rejected.', insertError?.code);
    return apiError(insertError?.code === '42501' ? 403 : 500,
      insertError?.code === '42501' ? 'You cannot send messages to this conversation.' : 'The message could not be saved.',
      insertError?.code === '42501' ? 'MESSAGE_NOT_ALLOWED' : 'MESSAGE_SAVE_FAILED');
  }

  let mediaRow: Database['public']['Tables']['media']['Row'] | null = null;
  if (uploaded) {
    const mediaId = (metadata as { mediaId: string }).mediaId;
    const { data, error } = await authorization.context.supabase.from('media').insert({
      id: mediaId,
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
    }).select('*').single();
    if (error || !data) {
      await authorization.context.supabase.from('messages').delete().eq('id', messageId).eq('sender_id', authorization.context.user.id);
      await removeUploadedMedia(authorization.context.supabase, uploaded);
      console.error('[NexaChat messages] Media metadata could not be saved.', error?.code);
      return apiError(500, 'The file could not be attached to the message.', 'MEDIA_METADATA_FAILED');
    }
    mediaRow = data;
  }
  return Response.json({ message, media: mediaRow }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
