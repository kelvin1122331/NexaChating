import { z } from 'zod';
import { apiError, authorizeApiRequest } from '@/lib/server/api';

/** Lists the authenticated user's recent notifications with an optional time cursor. */
export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 120, windowSeconds: 60, namespace: 'notification-list' },
  });
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  const limit = z.coerce.number().int().min(1).max(100).default(50).safeParse(url.searchParams.get('limit') ?? undefined);
  if (!limit.success) return apiError(400, 'The notification limit is invalid.', 'INVALID_QUERY');
  const before = url.searchParams.get('before');
  let query = authorization.context.supabase.from('notifications')
    .select('id,type,title,body,data,is_read,pushed,created_at')
    .eq('user_id', authorization.context.user.id)
    .order('created_at', { ascending: false })
    .limit(limit.data);
  if (before) {
    const timestamp = z.string().datetime({ offset: true }).safeParse(before);
    if (!timestamp.success) return apiError(400, 'The notification cursor is invalid.', 'INVALID_CURSOR');
    query = query.lt('created_at', new Date(timestamp.data).toISOString());
  }
  const { data, error } = await query;
  if (error) {
    console.error('[NexaChat notifications] Notifications could not be loaded.', error.code);
    return apiError(500, 'Notifications could not be loaded.', 'NOTIFICATION_LIST_FAILED');
  }
  return Response.json({ notifications: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
