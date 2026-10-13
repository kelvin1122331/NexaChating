import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';

const requestSchema = z.object({
  type: z.enum(['personal', 'group', 'channel', 'self']),
  title: z.string().trim().max(80).nullable().optional(),
  participantUserIds: z.array(z.string().uuid()).max(256).default([]),
  onlyAdminsMsg: z.boolean().default(false),
}).strict();

/** Creates a direct, group, channel, or saved-messages conversation atomically through an RLS-safe RPC. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 20, windowSeconds: 60, namespace: 'conversation-create' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = requestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The conversation request is invalid.', 'INVALID_REQUEST');
  if ((parsed.data.type === 'group' || parsed.data.type === 'channel') && !parsed.data.title?.trim()) {
    return apiError(400, 'Add a name for this conversation.', 'CONVERSATION_TITLE_REQUIRED');
  }
  const participantUserIds = [...new Set(parsed.data.participantUserIds)];
  if (participantUserIds.includes(authorization.context.user.id)) {
    return apiError(400, 'Do not include your account in the participant list.', 'PARTICIPANTS_INVALID');
  }
  const { data: conversationId, error } = await authorization.context.supabase.rpc('create_conversation', {
    p_type: parsed.data.type,
    p_title: parsed.data.title ?? null,
    p_participant_user_ids: participantUserIds,
    p_only_admins_msg: parsed.data.onlyAdminsMsg,
  });
  if (error || !conversationId) {
    if (error?.code === 'P0002') return apiError(404, 'One or more participants could not be found.', 'PARTICIPANT_NOT_FOUND');
    if (error?.code === '42501') return apiError(403, 'A blocked account cannot be added to this conversation.', 'PARTICIPANT_BLOCKED');
    if (error?.code === '22023') return apiError(400, 'The participant list does not match this conversation type.', 'PARTICIPANTS_INVALID');
    console.error('[NexaChat conversations] Conversation creation failed.', error?.code);
    return apiError(500, 'The conversation could not be created.', 'CONVERSATION_CREATE_FAILED');
  }
  return Response.json({ conversationId }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
