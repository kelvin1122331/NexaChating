import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';

const scheduleSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(20_000),
  scheduledAt: z.string().datetime({ offset: true }),
}).strict();

/** Lists the caller's unsent scheduled messages. */
export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 120, windowSeconds: 60, namespace: 'scheduled-list' },
  });
  if (!authorization.ok) return authorization.response;
  const { data, error } = await authorization.context.supabase.from('scheduled_messages')
    .select('id,conversation_id,content,type,scheduled_at,created_at')
    .eq('sender_id', authorization.context.user.id)
    .eq('sent', false)
    .order('scheduled_at', { ascending: true })
    .limit(100);
  if (error) {
    console.error('[NexaChat schedule] Scheduled messages could not be listed.', error.code);
    return apiError(500, 'Scheduled messages could not be loaded.', 'SCHEDULE_LIST_FAILED');
  }
  return Response.json({ messages: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Schedules a text message for a future time within one year. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 30, windowSeconds: 60, namespace: 'scheduled-create' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = scheduleSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The scheduled message request is invalid.', 'INVALID_REQUEST');
  if (!await requireConversationMembership(authorization.context, parsed.data.conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  const scheduledAt = new Date(parsed.data.scheduledAt);
  const now = Date.now();
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < now + 60_000 || scheduledAt.getTime() > now + 366 * 24 * 60 * 60 * 1_000) {
    return apiError(400, 'Choose a time at least one minute from now and within the next year.', 'SCHEDULE_TIME_INVALID');
  }
  const { data, error } = await authorization.context.supabase.from('scheduled_messages').insert({
    sender_id: authorization.context.user.id,
    conversation_id: parsed.data.conversationId,
    content: parsed.data.content,
    type: 'text',
    scheduled_at: scheduledAt.toISOString(),
  }).select('id,conversation_id,content,type,scheduled_at,created_at').single();
  if (error || !data) {
    console.warn('[NexaChat schedule] Scheduled message could not be saved.', error?.code);
    return apiError(error?.code === '42501' ? 403 : 500,
      error?.code === '42501' ? 'You cannot schedule messages in this conversation.' : 'The scheduled message could not be saved.',
      error?.code === '42501' ? 'MESSAGE_NOT_ALLOWED' : 'SCHEDULE_SAVE_FAILED');
  }
  return Response.json({ message: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
