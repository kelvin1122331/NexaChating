import { streamText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody, requireConversationMembership } from '@/lib/server/api';
import { getOpenAIModel } from '@/lib/ai/openai';
import { NEXA_AI_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { aiActionRateLimit } from '@/lib/ai/actions';
import { recordAiUsage } from '@/lib/ai/log';

export const runtime = 'nodejs';

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(6_000),
  }).strict()).min(1).max(30),
}).strict().superRefine((body, context) => {
  if (body.messages.at(-1)?.role !== 'user') context.addIssue({ code: 'custom', message: 'The last message must be from the user.' });
  if (body.messages.reduce((length, message) => length + message.content.length, 0) > 20_000) {
    context.addIssue({ code: 'custom', message: 'The conversation is too long.' });
  }
});

/** Streams an authenticated Nexa AI reply; conversation IDs are checked against RLS membership. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, { rateLimit: aiActionRateLimit });
  if (!authorization.ok) return authorization.response;
  const parsed = chatRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The chat request is invalid.', 'INVALID_REQUEST');
  if (parsed.data.conversationId && !await requireConversationMembership(authorization.context, parsed.data.conversationId)) {
    return apiError(404, 'Conversation not found.', 'CONVERSATION_NOT_FOUND');
  }
  const model = getOpenAIModel();
  if (!model) return apiError(503, 'AI is not configured for this deployment.', 'AI_NOT_CONFIGURED');

  const startedAt = Date.now();
  try {
    const messages: ModelMessage[] = parsed.data.messages.map((message) => ({ role: message.role, content: message.content }));
    const result = streamText({
      model,
      system: NEXA_AI_SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 1_000,
      abortSignal: request.signal,
      onFinish: async ({ usage }) => recordAiUsage(authorization.context, 'general_chat', usage, startedAt),
    });
    return result.toTextStreamResponse({
      headers: {
        'Cache-Control': 'no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (request.signal.aborted) return apiError(408, 'The AI request was cancelled.', 'REQUEST_CANCELLED');
    console.error('[NexaChat AI] Chat stream could not be started.', error);
    return apiError(502, 'The AI service could not start this request.', 'AI_PROVIDER_ERROR');
  }
}
