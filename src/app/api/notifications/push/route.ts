import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({ messageId: z.string().uuid() }).strict();
const ONESIGNAL_ENDPOINT = 'https://onesignal.com/api/v1/notifications';

/** Sends privacy-preserving push alerts to unmuted conversation members after verifying the caller sent the message. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 20, windowSeconds: 60, namespace: 'push-send' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = requestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The push request is invalid.', 'INVALID_REQUEST');
  const { data: message, error: messageError } = await authorization.context.supabase.from('messages')
    .select('id,conversation_id,sender_id,type,created_at')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (messageError || !message) return apiError(404, 'Message not found.', 'MESSAGE_NOT_FOUND');
  if (message.sender_id !== authorization.context.user.id) return apiError(403, 'Only the sender can notify conversation members.', 'PUSH_NOT_ALLOWED');

  const admin = createSupabaseAdminClient();
  if (!admin) return apiError(503, 'Supabase service credentials are not configured.', 'BACKEND_NOT_CONFIGURED');
  const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
  const oneSignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!oneSignalAppId || !oneSignalRestApiKey) return apiError(503, 'Push notifications are not configured.', 'PUSH_NOT_CONFIGURED');

  const { data: members, error: membersError } = await admin.from('conversation_members')
    .select('user_id,is_muted,mute_until')
    .eq('conversation_id', message.conversation_id)
    .is('left_at', null)
    .neq('user_id', message.sender_id)
    .limit(1_000);
  if (membersError) {
    console.error('[NexaChat push] Conversation recipients could not be loaded.', membersError.code);
    return apiError(500, 'Push recipients could not be loaded.', 'PUSH_RECIPIENTS_FAILED');
  }
  const unmutedIds = (members ?? []).filter((member) => !member.is_muted || (member.mute_until && new Date(member.mute_until).getTime() <= Date.now()))
    .map((member) => member.user_id);
  if (unmutedIds.length === 0) return Response.json({ queued: 0 }, { headers: { 'Cache-Control': 'no-store' } });

  const { data: blocked, error: blockedError } = await admin.from('contacts')
    .select('user_id')
    .in('user_id', unmutedIds)
    .eq('contact_user_id', message.sender_id)
    .eq('is_blocked', true);
  if (blockedError) {
    console.error('[NexaChat push] Block preferences could not be loaded.', blockedError.code);
    return apiError(500, 'Push preferences could not be loaded.', 'PUSH_RECIPIENTS_FAILED');
  }
  const blockedIds = new Set((blocked ?? []).map((entry) => entry.user_id));
  const recipientIds = unmutedIds.filter((id) => !blockedIds.has(id));
  if (recipientIds.length === 0) return Response.json({ queued: 0 }, { headers: { 'Cache-Control': 'no-store' } });

  const { data: users, error: usersError } = await admin.from('users')
    .select('id,onesignal_id')
    .in('id', recipientIds)
    .is('deleted_at', null);
  if (usersError) {
    console.error('[NexaChat push] Push subscriptions could not be loaded.', usersError.code);
    return apiError(500, 'Push subscriptions could not be loaded.', 'PUSH_RECIPIENTS_FAILED');
  }
  const playerIds = (users ?? []).map((user) => user.onesignal_id).filter((id): id is string => Boolean(id));
  const createdAt = new Date().toISOString();
  const notificationRows = recipientIds.map((userId) => ({
    user_id: userId,
    type: 'message',
    title: 'New message',
    body: null,
    data: { conversationId: message.conversation_id, messageId: message.id },
    pushed: false,
    created_at: createdAt,
  }));
  const notificationIdByUser = new Map<string, string>();
  for (let offset = 0; offset < notificationRows.length; offset += 500) {
    const { data, error } = await admin.from('notifications').insert(notificationRows.slice(offset, offset + 500)).select('id,user_id');
    if (error) {
      console.error('[NexaChat push] In-app notifications could not be saved.', error.code);
      return apiError(500, 'Notifications could not be saved.', 'NOTIFICATION_SAVE_FAILED');
    }
    for (const notification of data ?? []) notificationIdByUser.set(notification.user_id, notification.id);
  }

  if (playerIds.length > 0) {
    const batches = Array.from({ length: Math.ceil(playerIds.length / 2_000) }, (_, index) => playerIds.slice(index * 2_000, (index + 1) * 2_000));
    try {
      const responses = await Promise.all(batches.map((includePlayerIds) => fetch(ONESIGNAL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${oneSignalRestApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          include_player_ids: includePlayerIds,
          headings: { en: 'NexaChat' },
          contents: { en: 'You have a new message.' },
          data: { conversationId: message.conversation_id, messageId: message.id },
          content_available: true,
        }),
        signal: AbortSignal.timeout(10_000),
      })));
      if (responses.some((response) => !response.ok)) {
        console.error('[NexaChat push] OneSignal rejected a notification batch.', responses.map((response) => response.status));
        return apiError(502, 'Some push notifications could not be sent.', 'PUSH_PROVIDER_ERROR');
      }
      const sentUserIds = (users ?? []).filter((user) => Boolean(user.onesignal_id)).map((user) => user.id);
      const pushedNotificationIds = sentUserIds.flatMap((userId) => {
        const notificationId = notificationIdByUser.get(userId);
        return notificationId ? [notificationId] : [];
      });
      for (let offset = 0; offset < pushedNotificationIds.length; offset += 500) {
        const { error: updateError } = await admin.from('notifications').update({ pushed: true }).in('id', pushedNotificationIds.slice(offset, offset + 500));
        if (updateError) console.warn('[NexaChat push] Push state could not be updated.', updateError.code);
      }
    } catch (error) {
      console.error('[NexaChat push] OneSignal request failed.', error);
      return apiError(502, 'Push notifications could not be sent.', 'PUSH_PROVIDER_ERROR');
    }
  }
  return Response.json({ queued: recipientIds.length, pushedTo: playerIds.length }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
