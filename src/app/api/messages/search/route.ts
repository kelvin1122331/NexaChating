import { z } from 'zod';
import { apiError, authorizeApiRequest, requireConversationMembership } from '@/lib/server/api';

const uuidSchema = z.string().uuid();

/** Searches only RLS-visible, non-deleted messages and bounds the result count. */
export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 60, windowSeconds: 60, namespace: 'message-search' },
  });
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  const query = z.string().trim().min(2).max(120).safeParse(url.searchParams.get('q'));
  if (!query.success) return apiError(400, 'Search text must contain 2–120 characters.', 'INVALID_QUERY');
  const conversationId = url.searchParams.get('conversationId');
  if (conversationId) {
    const parsedId = uuidSchema.safeParse(conversationId);
    if (!parsedId.success) return apiError(400, 'The conversation ID is invalid.', 'INVALID_CONVERSATION_ID');
    if (!await requireConversationMembership(authorization.context, parsedId.data)) return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }

  const escaped = query.data.replace(/[\\%_]/g, '\\$&');
  let search = authorization.context.supabase.from('messages')
    .select('id,conversation_id,sender_id,type,content,metadata,reply_to_id,created_at')
    .ilike('content', `%${escaped}%`)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(30);
  if (conversationId) search = search.eq('conversation_id', conversationId);
  const { data, error } = await search;
  if (error) {
    console.error('[NexaChat search] Message search failed.', error.code);
    return apiError(500, 'Messages could not be searched.', 'MESSAGE_SEARCH_FAILED');
  }
  return Response.json({ messages: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
