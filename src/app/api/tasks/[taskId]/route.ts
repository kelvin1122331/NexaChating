import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';

const uuidSchema = z.string().uuid();
const dateSchema = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const updateSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
  dueDate: dateSchema.nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update.');

/** Updates an RLS-visible task and maintains its completion timestamp. */
export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 60, windowSeconds: 60, namespace: 'task-update' },
  });
  if (!authorization.ok) return authorization.response;
  const { taskId: rawId } = await context.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return apiError(400, 'The task ID is invalid.', 'INVALID_ID');
  const parsed = updateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The task update is invalid.', 'INVALID_REQUEST');
  const { data: existing, error: lookupError } = await authorization.context.supabase.from('tasks')
    .select('id,status').eq('id', parsedId.data).maybeSingle();
  if (lookupError || !existing) return apiError(404, 'Task not found.', 'TASK_NOT_FOUND');

  const update: {
    title?: string;
    description?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: 'pending' | 'in_progress' | 'done' | 'cancelled';
    due_date?: string | null;
    completed_at?: string | null;
  } = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) {
    const value = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (value && !Number.isFinite(value.getTime())) return apiError(400, 'The task due date is invalid.', 'DUE_DATE_INVALID');
    update.due_date = value?.toISOString() ?? null;
  }
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.completed_at = parsed.data.status === 'done' ? new Date().toISOString() : null;
  }
  const { data, error } = await authorization.context.supabase.from('tasks').update(update)
    .eq('id', parsedId.data)
    .select('id,creator_id,assignee_id,conversation_id,source_msg_id,title,description,priority,status,due_date,reminder_at,completed_at,tags,created_at,updated_at')
    .maybeSingle();
  if (error || !data) {
    console.error('[NexaChat tasks] Task update failed.', error?.code);
    return apiError(403, 'You cannot update this task.', 'TASK_UPDATE_FAILED');
  }
  return Response.json({ task: data }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Deletes a task owned by the caller. */
export async function DELETE(request: Request, context: { params: Promise<{ taskId: string }> }): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 30, windowSeconds: 60, namespace: 'task-delete' },
  });
  if (!authorization.ok) return authorization.response;
  const { taskId: rawId } = await context.params;
  const parsedId = uuidSchema.safeParse(rawId);
  if (!parsedId.success) return apiError(400, 'The task ID is invalid.', 'INVALID_ID');
  const { data, error } = await authorization.context.supabase.from('tasks').delete()
    .eq('id', parsedId.data).select('id').maybeSingle();
  if (error) return apiError(403, 'You cannot delete this task.', 'TASK_DELETE_FAILED');
  if (!data) return apiError(404, 'Task not found.', 'TASK_NOT_FOUND');
  return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
