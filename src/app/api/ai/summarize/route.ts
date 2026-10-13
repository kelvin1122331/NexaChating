import { z } from 'zod';
import { runTextAIAction, sourceTextSchema } from '@/lib/ai/actions';
import { buildSummaryPrompt } from '@/lib/ai/prompts';

const requestSchema = z.object({ text: sourceTextSchema }).strict();

/** Returns a concise, privacy-minimized summary of user-provided message text. */
export async function POST(request: Request): Promise<Response> {
  return runTextAIAction({ request, schema: requestSchema, action: 'summarize', buildPrompt: ({ text }) => buildSummaryPrompt(text) });
}
