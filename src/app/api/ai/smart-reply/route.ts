import { z } from 'zod';
import { runTextAIAction, sourceTextSchema } from '@/lib/ai/actions';
import { buildSmartReplyPrompt } from '@/lib/ai/prompts';

const requestSchema = z.object({
  text: sourceTextSchema,
  tone: z.enum(['friendly', 'professional', 'casual', 'concise']).default('friendly'),
}).strict();

/** Suggests three draft replies; sending remains an explicit user action. */
export async function POST(request: Request): Promise<Response> {
  return runTextAIAction({
    request,
    schema: requestSchema,
    action: 'smart_reply',
    buildPrompt: ({ text, tone }) => buildSmartReplyPrompt(text, tone),
  });
}
