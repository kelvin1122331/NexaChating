import { generateText } from 'ai';
import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';
import { getOpenAIModel } from '@/lib/ai/openai';
import { NEXA_AI_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { recordAiUsage } from '@/lib/ai/log';
import type { Database } from '@/lib/types/database';

export const aiActionRateLimit = { limit: 50, windowSeconds: 86_400, namespace: 'ai' } as const;
export const sourceTextSchema = z.string().trim().min(1).max(20_000);

/** Executes a validated, authenticated AI text action with shared rate limiting and usage logging. */
export async function runTextAIAction<TSchema extends z.ZodType>(options: {
  request: Request;
  schema: TSchema;
  action: Database['public']['Enums']['ai_action'];
  buildPrompt: (input: z.infer<TSchema>) => string;
}): Promise<Response> {
  const authorization = await authorizeApiRequest(options.request, { rateLimit: aiActionRateLimit });
  if (!authorization.ok) return authorization.response;
  const body = await readJsonBody(options.request);
  const parsed = options.schema.safeParse(body);
  if (!parsed.success) return apiError(400, 'The request body is invalid.', 'INVALID_REQUEST');

  const model = getOpenAIModel();
  if (!model) return apiError(503, 'AI is not configured for this deployment.', 'AI_NOT_CONFIGURED');

  const startedAt = Date.now();
  try {
    const result = await generateText({
      model,
      system: NEXA_AI_SYSTEM_PROMPT,
      prompt: options.buildPrompt(parsed.data),
      maxOutputTokens: 1_200,
      abortSignal: options.request.signal,
    });
    await recordAiUsage(authorization.context, options.action, result.usage, startedAt);
    return Response.json({ result: result.text }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (options.request.signal.aborted) return apiError(408, 'The AI request was cancelled.', 'REQUEST_CANCELLED');
    console.error(`[NexaChat AI] ${options.action} generation failed.`, error);
    return apiError(502, 'The AI service could not complete this request.', 'AI_PROVIDER_ERROR');
  }
}

export const targetLanguageSchema = z.string().trim().min(2).max(60).regex(/^[\p{L}\p{M}\p{N} ()-]+$/u);
