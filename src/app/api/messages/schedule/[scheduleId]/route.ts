import { z } from 'zod';
import { apiError, authorizeApiRequest } from '@/lib/server/api';

const uuidSchema = z.string().uuid();

/** Deletes an unsent scheduled message owned by the caller. */
export async function DELETE(request: Request, context: { params: Promise<{ scheduleId: string }> }): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 30, windowSeconds: 60, namespace: 'scheduled-cancel' },
  });
  if (!authorization.ok) return authorization.response;
  const { scheduleId: rawId } = await context.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return apiError(400, 'The scheduled message ID is invalid.', 'INVALID_ID');
  const { data, error } = await authorization.context.supabase.from('scheduled_messages')
    .delete()
    .eq('id', parsedId.data)
    .eq('sender_id', authorization.context.user.id)
    .eq('sent', false)
    .select('id')
    .maybeSingle();
  if (error) {
    console.warn('[NexaChat schedule] Scheduled message could not be cancelled.', error.code);
    return apiError(500, 'The scheduled message could not be cancelled.', 'SCHEDULE_CANCEL_FAILED');
  }
  if (!data) return apiError(404, 'Scheduled message not found.', 'SCHEDULE_NOT_FOUND');
  return Response.json({ cancelled: true }, { headers: { 'Cache-Control': 'no-store' } });
}
