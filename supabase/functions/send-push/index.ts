interface DenoRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
}

interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  is_deleted: boolean;
}

interface ConversationMember {
  user_id: string;
  is_muted: boolean;
  mute_until: string | null;
}

interface PushUser {
  id: string;
  onesignal_id: string | null;
}

interface ExistingNotification {
  id: string;
  user_id: string;
  pushed: boolean;
}

interface InsertedNotification {
  id: string;
  user_id: string;
}

interface NotificationInsert {
  user_id: string;
  type: 'message';
  title: string;
  body: null;
  data: { conversationId: string; messageId: string };
  pushed: false;
}

const runtime = (globalThis as typeof globalThis & { Deno?: DenoRuntime }).Deno;
if (!runtime) throw new Error('This Supabase Edge Function must run on Deno.');

const SUPABASE_URL = runtime.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
const SERVICE_ROLE_KEY = runtime.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PUSH_FUNCTION_SECRET = runtime.env.get('PUSH_FUNCTION_SECRET');
const ONESIGNAL_APP_ID = runtime.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_REST_API_KEY = runtime.env.get('ONESIGNAL_REST_API_KEY');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ONESIGNAL_ENDPOINT = 'https://onesignal.com/api/v1/notifications';

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageIdFromPayload(value: unknown): string | null {
  if (!isObject(value)) return null;
  const direct = value.messageId;
  const record = value.record;
  const id = typeof direct === 'string' ? direct : isObject(record) ? record.id : null;
  return typeof id === 'string' && UUID_PATTERN.test(id) ? id : null;
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('SUPABASE_CONFIGURATION_MISSING');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error('[NexaChat send-push] Supabase REST request failed.', response.status);
    throw new Error('SUPABASE_REQUEST_FAILED');
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!PUSH_FUNCTION_SECRET) return json(503, { error: 'Push delivery is not configured.' });
  const authorization = request.headers.get('authorization') ?? '';
  const suppliedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!constantTimeEqual(suppliedSecret, PUSH_FUNCTION_SECRET)) return json(401, { error: 'Unauthorized.' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(503, { error: 'Push delivery is not configured.' });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_384) return json(413, { error: 'The request is too large.' });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'The request body is invalid.' });
  }
  const messageId = messageIdFromPayload(payload);
  if (!messageId) return json(400, { error: 'A valid message ID is required.' });

  try {
    const messageQuery = new URLSearchParams({
      select: 'id,conversation_id,sender_id,type,is_deleted',
      id: `eq.${messageId}`,
      limit: '1',
    });
    const messages = await supabaseRequest<ConversationMessage[]>(`messages?${messageQuery}`);
    const message = messages[0];
    if (!message || message.is_deleted) return json(404, { error: 'Message not found.' });

    const memberQuery = new URLSearchParams({
      select: 'user_id,is_muted,mute_until',
      conversation_id: `eq.${message.conversation_id}`,
      left_at: 'is.null',
      user_id: `neq.${message.sender_id}`,
      limit: '1000',
    });
    const members = await supabaseRequest<ConversationMember[]>(`conversation_members?${memberQuery}`);
    const now = Date.now();
    const eligibleIds = members
      .filter((member) => !member.is_muted || (member.mute_until !== null && Date.parse(member.mute_until) <= now))
      .map((member) => member.user_id)
      .filter((userId) => UUID_PATTERN.test(userId));
    if (eligibleIds.length === 0) return json(200, { queued: 0, pushedTo: 0 });

    const blockedQuery = new URLSearchParams({
      select: 'user_id',
      user_id: `in.(${eligibleIds.join(',')})`,
      contact_user_id: `eq.${message.sender_id}`,
      is_blocked: 'eq.true',
    });
    const blocked = await supabaseRequest<Array<{ user_id: string }>>(`contacts?${blockedQuery}`);
    const blockedIds = new Set(blocked.map((item) => item.user_id));
    const recipientIds = eligibleIds.filter((userId) => !blockedIds.has(userId));
    if (recipientIds.length === 0) return json(200, { queued: 0, pushedTo: 0 });

    const userQuery = new URLSearchParams({
      select: 'id,onesignal_id',
      id: `in.(${recipientIds.join(',')})`,
      deleted_at: 'is.null',
    });
    const users = await supabaseRequest<PushUser[]>(`users?${userQuery}`);
    const userById = new Map(users.map((user) => [user.id, user]));

    const existingQuery = new URLSearchParams({
      select: 'id,user_id,pushed',
      user_id: `in.(${recipientIds.join(',')})`,
      type: 'eq.message',
      'data->>messageId': `eq.${message.id}`,
      limit: '1000',
    });
    const existing = await supabaseRequest<ExistingNotification[]>(`notifications?${existingQuery}`);
    const existingByUser = new Map(existing.map((notification) => [notification.user_id, notification]));
    const toInsert: NotificationInsert[] = recipientIds
      .filter((userId) => !existingByUser.has(userId))
      .map((userId) => ({
        user_id: userId,
        type: 'message',
        title: 'New message',
        body: null,
        data: { conversationId: message.conversation_id, messageId: message.id },
        pushed: false,
      }));

    let inserted: InsertedNotification[] = [];
    if (toInsert.length > 0) {
      inserted = await supabaseRequest<InsertedNotification[]>('notifications?select=id,user_id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(toInsert),
      });
    }

    const notificationByUser = new Map(existing.map((notification) => [notification.user_id, notification]));
    for (const notification of inserted) {
      notificationByUser.set(notification.user_id, { ...notification, pushed: false });
    }

    const pushRecipients = recipientIds.flatMap((userId) => {
      const user = userById.get(userId);
      const notification = notificationByUser.get(userId);
      if (!user?.onesignal_id || !notification || notification.pushed) return [];
      return [{ userId, playerId: user.onesignal_id, notificationId: notification.id }];
    });
    const playerBatches: string[][] = [];
    for (let offset = 0; offset < pushRecipients.length; offset += 2_000) {
      playerBatches.push(pushRecipients.slice(offset, offset + 2_000).map((recipient) => recipient.playerId));
    }

    if (playerBatches.length > 0) {
      const responses = await Promise.all(playerBatches.map((includePlayerIds) => fetch(ONESIGNAL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: includePlayerIds,
          headings: { en: 'NexaChat' },
          contents: { en: 'You have a new message.' },
          data: { conversationId: message.conversation_id, messageId: message.id, type: 'new_message' },
          content_available: true,
        }),
        signal: AbortSignal.timeout(10_000),
      })));
      if (responses.some((response) => !response.ok)) {
        console.error('[NexaChat send-push] OneSignal rejected a delivery batch.', responses.map((response) => response.status));
        return json(502, { error: 'Push delivery failed.' });
      }
      const deliveredNotificationIds = pushRecipients.map((recipient) => recipient.notificationId);
      for (let offset = 0; offset < deliveredNotificationIds.length; offset += 500) {
        const ids = deliveredNotificationIds.slice(offset, offset + 500);
        const updateQuery = new URLSearchParams({ id: `in.(${ids.join(',')})` });
        await supabaseRequest<undefined>(`notifications?${updateQuery}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ pushed: true }),
        });
      }
    }

    return json(202, { queued: recipientIds.length, pushedTo: pushRecipients.length });
  } catch (error) {
    console.error('[NexaChat send-push] Delivery failed.', error instanceof Error ? error.message : 'UNKNOWN_ERROR');
    return json(500, { error: 'Push delivery could not be completed.' });
  }
}

runtime.serve(handleRequest);
