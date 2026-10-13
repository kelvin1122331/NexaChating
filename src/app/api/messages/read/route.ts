import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

/** Marks up to 100 visible conversation messages as read and resets only the caller's unread counter. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 120, windowSeconds: 60, namespace: 'message-read' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = requestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The read receipt request is invalid.', 'INVALID_REQUEST');
  const { conversationId } = parsed.data;
  if (!await requireConversationMembership(authorization.context, conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  const messageIds = [...new Set(parsed.data.messageIds)];
  const { data: messages, error: messagesError } = await authorization.context.supabase.from('messages')
    .select('id,sender_id,created_at')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .in('id', messageIds);
  if (messagesError) return apiError(500, 'Read receipts could not be saved.', 'READ_RECEIPT_FAILED');
  if (!messages?.length) return Response.json({ markedRead: 0 }, { headers: { 'Cache-Control': 'no-store' } });

  const latestMessage = [...messages].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
  const { error: memberError } = await authorization.context.supabase.from('conversation_members')
    .update({ unread_count: 0, last_read_msg: latestMessage?.id ?? null })
    .eq('conversation_id', conversationId)
    .eq('user_id', authorization.context.user.id);
  if (memberError) {
    console.error('[NexaChat read receipts] Conversation read cursor could not be updated.', memberError.code);
    return apiError(500, 'The conversation could not be marked as read.', 'READ_RECEIPT_FAILED');
  }

  const readAt = new Date().toISOString();
  const receipts = messages.filter((message) => message.sender_id !== authorization.context.user.id)
    .map((message) => ({ message_id: message.id, user_id: authorization.context.user.id, delivered_at: readAt, read_at: readAt }));
  if (receipts.length) {
    const { error } = await authorization.context.supabase.from('message_receipts')
      .upsert(receipts, { onConflict: 'message_id,user_id' });
    if (error) {
      console.warn('[NexaChat read receipts] Per-message read receipts were not stored.', error.code);
      return apiError(500, 'Read receipts could not be saved.', 'READ_RECEIPT_FAILED');
    }
  }
  return Response.json({ markedRead: messages.length, lastReadMessageId: latestMessage?.id ?? null }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
