import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';

const uuidSchema = z.string().uuid();
const updateSchema = z.object({ isRead: z.boolean() }).strict();

/** Updates only the authenticated user's read flag for one notification. */
export async function PATCH(request: Request, context: { params: Promise<{ notificationId: string }> }): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 60, windowSeconds: 60, namespace: 'notification-update' },
  });
  if (!authorization.ok) return authorization.response;
  const { notificationId: rawId } = await context.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return apiError(400, 'The notification ID is invalid.', 'INVALID_ID');
  const body = updateSchema.safeParse(await readJsonBody(request));
  if (!body.success) return apiError(400, 'The notification update is invalid.', 'INVALID_REQUEST');
  const { data, error } = await authorization.context.supabase.from('notifications')
    .update({ is_read: body.data.isRead })
    .eq('id', parsedId.data)
    .eq('user_id', authorization.context.user.id)
    .select('id,is_read')
    .maybeSingle();
  if (error) {
    console.error('[NexaChat notifications] Read status could not be updated.', error.code);
    return apiError(500, 'Notification status could not be updated.', 'NOTIFICATION_UPDATE_FAILED');
  }
  if (!data) return apiError(404, 'Notification not found.', 'NOTIFICATION_NOT_FOUND');
  return Response.json({ notification: data }, { headers: { 'Cache-Control': 'no-store' } });
}
