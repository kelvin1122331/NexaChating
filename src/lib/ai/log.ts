import 'server-only';
import type { LanguageModelUsage } from 'ai';
import { AI_MODEL_ID } from '@/lib/ai/openai';
import type { AuthenticatedApiContext } from '@/lib/server/api';
import type { Database } from '@/lib/types/database';

/** Writes privacy-minimized AI usage telemetry; failures never interrupt a completed response. */
export async function recordAiUsage(
  context: AuthenticatedApiContext,
  action: Database['public']['Enums']['ai_action'],
  usage: LanguageModelUsage,
  startedAt: number,
): Promise<void> {
  try {
    const { error } = await context.supabase.from('ai_logs').insert({
      user_id: context.user.id,
      action,
      model: AI_MODEL_ID,
      input_tokens: usage.inputTokens ?? 0,
      output_tokens: usage.outputTokens ?? 0,
      latency_ms: Math.max(0, Date.now() - startedAt),
      prompt: null,
      response: null,
      cost_usd: 0,
    });
    if (error) console.warn('[NexaChat AI] Usage telemetry could not be stored.', error.message);
  } catch (error) {
    console.warn('[NexaChat AI] Usage telemetry could not be stored.', error);
  }
}
