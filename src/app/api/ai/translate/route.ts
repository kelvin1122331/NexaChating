import { z } from 'zod';
import { runTextAIAction, sourceTextSchema, targetLanguageSchema } from '@/lib/ai/actions';
import { buildTranslationPrompt } from '@/lib/ai/prompts';

const requestSchema = z.object({ text: sourceTextSchema, targetLanguage: targetLanguageSchema }).strict();

/** Translates validated text into the requested language without mutating stored messages. */
export async function POST(request: Request): Promise<Response> {
  return runTextAIAction({
    request,
    schema: requestSchema,
    action: 'translate',
    buildPrompt: ({ text, targetLanguage }) => buildTranslationPrompt(text, targetLanguage),
  });
}
