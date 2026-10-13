import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/** Returns the configured server-side chat model, or null when no provider key is configured. */
export function getOpenAIModel(): LanguageModel | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return createOpenAI({ apiKey, name: 'nexachat-openai' })(AI_MODEL_ID);
}

export const AI_MODEL_ID = 'gpt-4o-mini';
