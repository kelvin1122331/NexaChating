import { generateText } from 'ai';
import { z } from 'zod';
import { aiActionRateLimit, sourceTextSchema } from '@/lib/ai/actions';
import { getOpenAIModel } from '@/lib/ai/openai';
import { buildTaskExtractionPrompt, NEXA_AI_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { recordAiUsage } from '@/lib/ai/log';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';

export const runtime = 'nodejs';

const requestSchema = z.object({
  text: sourceTextSchema,
  conversationId: z.string().uuid().optional(),
  sourceMessageId: z.string().uuid().optional(),
  save: z.boolean().default(false),
}).strict().superRefine((body, context) => {
  if (body.sourceMessageId && !body.conversationId) {
    context.addIssue({ code: 'custom', message: 'A source message requires its conversation ID.' });
  }
});
const extractedTaskSchema = z.object({
  title: z.string().trim().max(180),
  description: z.string().trim().max(2_000).nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().datetime({ offset: true }).nullable(),
}).strict();

/** Extracts a reviewable task candidate and only persists it when save is explicitly true. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, { rateLimit: aiActionRateLimit });
  if (!authorization.ok) return authorization.response;
  const parsedRequest = requestSchema.safeParse(await readJsonBody(request));
  if (!parsedRequest.success) return apiError(400, 'The task extraction request is invalid.', 'INVALID_REQUEST');
  const input = parsedRequest.data;
  if (input.conversationId && !await requireConversationMembership(authorization.context, input.conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  if (input.sourceMessageId && input.conversationId) {
    const { data: sourceMessage, error } = await authorization.context.supabase
      .from('messages')
      .select('id')
      .eq('id', input.sourceMessageId)
      .eq('conversation_id', input.conversationId)
      .maybeSingle();
    if (error || !sourceMessage) return apiError(404, 'Source message not found.', 'MESSAGE_NOT_FOUND');
  }

  const model = getOpenAIModel();
  if (!model) return apiError(503, 'AI is not configured for this deployment.', 'AI_NOT_CONFIGURED');
  const startedAt = Date.now();
  try {
    const generated = await generateText({
      model,
      system: NEXA_AI_SYSTEM_PROMPT,
      prompt: buildTaskExtractionPrompt(input.text),
      maxOutputTokens: 400,
      abortSignal: request.signal,
    });
    await recordAiUsage(authorization.context, 'task_extract', generated.usage, startedAt);
    const jsonText = generated.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let decoded: unknown;
    try { decoded = JSON.parse(jsonText) as unknown; }
    catch { return apiError(502, 'The AI service returned an invalid task result.', 'AI_INVALID_RESPONSE'); }
    const candidate = extractedTaskSchema.safeParse(decoded);
    if (!candidate.success) return apiError(502, 'The AI service returned an invalid task result.', 'AI_INVALID_RESPONSE');
    if (!candidate.data.title) return Response.json({ task: null }, { headers: { 'Cache-Control': 'no-store' } });

    if (!input.save) return Response.json({ task: candidate.data }, { headers: { 'Cache-Control': 'no-store' } });
    const { data: task, error } = await authorization.context.supabase.from('tasks').insert({
      creator_id: authorization.context.user.id,
      assignee_id: authorization.context.user.id,
      conversation_id: input.conversationId ?? null,
      source_msg_id: input.sourceMessageId ?? null,
      title: candidate.data.title,
      description: candidate.data.description,
      priority: candidate.data.priority,
      status: 'pending',
      due_date: candidate.data.dueDate,
    }).select('id,title,description,priority,status,due_date,created_at').single();
    if (error || !task) {
      console.error('[NexaChat AI] Extracted task could not be saved.', error?.message);
      return apiError(500, 'The extracted task could not be saved.', 'TASK_SAVE_FAILED');
    }
    return Response.json({ task }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (request.signal.aborted) return apiError(408, 'The AI request was cancelled.', 'REQUEST_CANCELLED');
    console.error('[NexaChat AI] Task extraction failed.', error);
    return apiError(502, 'The AI service could not complete this request.', 'AI_PROVIDER_ERROR');
  }
}
