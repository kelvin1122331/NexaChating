import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';

const dateSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
]);
const createSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2_000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigneeId: z.string().uuid().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  sourceMessageId: z.string().uuid().nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
}).strict().superRefine((input, context) => {
  if (input.sourceMessageId && !input.conversationId) context.addIssue({ code: 'custom', message: 'A source message requires a conversation.' });
});

/** Lists tasks visible to the caller through task RLS. */
export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 120, windowSeconds: 60, namespace: 'task-list' },
  });
  if (!authorization.ok) return authorization.response;
  const { data, error } = await authorization.context.supabase.from('tasks')
    .select('id,creator_id,assignee_id,conversation_id,source_msg_id,title,description,priority,status,due_date,reminder_at,completed_at,tags,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[NexaChat tasks] Tasks could not be loaded.', error.code);
    return apiError(500, 'Tasks could not be loaded.', 'TASK_LIST_FAILED');
  }
  return Response.json({ tasks: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Creates a task owned by the caller and verifies conversation/source-message access. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 30, windowSeconds: 60, namespace: 'task-create' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = createSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The task request is invalid.', 'INVALID_REQUEST');
  const conversationId = parsed.data.conversationId ?? null;
  if (conversationId && !await requireConversationMembership(authorization.context, conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  if (parsed.data.sourceMessageId) {
    const { data: message, error } = await authorization.context.supabase.from('messages')
      .select('id,conversation_id').eq('id', parsed.data.sourceMessageId).maybeSingle();
    if (error || !message) return apiError(404, 'Source message not found.', 'MESSAGE_NOT_FOUND');
    if (conversationId !== message.conversation_id) return apiError(400, 'The source message belongs to a different conversation.', 'INVALID_SOURCE_MESSAGE');
  }
  const assigneeId = parsed.data.assigneeId ?? authorization.context.user.id;
  if (assigneeId !== authorization.context.user.id) {
    if (!conversationId) return apiError(400, 'Assigning another user requires a shared conversation.', 'ASSIGNEE_INVALID');
    const { data: member, error } = await authorization.context.supabase.from('conversation_members')
      .select('user_id').eq('conversation_id', conversationId).eq('user_id', assigneeId).is('left_at', null).maybeSingle();
    if (error || !member) return apiError(400, 'The assignee must be an active conversation member.', 'ASSIGNEE_INVALID');
  }
  const dueDateValue = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (dueDateValue && !Number.isFinite(dueDateValue.getTime())) return apiError(400, 'The task due date is invalid.', 'DUE_DATE_INVALID');
  const dueDate = dueDateValue?.toISOString() ?? null;
  const { data: task, error } = await authorization.context.supabase.from('tasks').insert({
    creator_id: authorization.context.user.id,
    assignee_id: assigneeId,
    conversation_id: conversationId,
    source_msg_id: parsed.data.sourceMessageId ?? null,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    priority: parsed.data.priority,
    due_date: dueDate,
    status: 'pending',
  }).select('id,creator_id,assignee_id,conversation_id,source_msg_id,title,description,priority,status,due_date,reminder_at,completed_at,tags,created_at,updated_at').single();
  if (error || !task) {
    console.warn('[NexaChat tasks] Task creation was rejected.', error?.code);
    return apiError(error?.code === '42501' ? 403 : 500, 'The task could not be created.', 'TASK_CREATE_FAILED');
  }
  return Response.json({ task }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
