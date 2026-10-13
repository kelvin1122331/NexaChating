import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AiAssistant } from '@/components/ai/ai-assistant';

export const metadata: Metadata = { title: 'Nexa AI' };

/** AI assistant route with a fast fallback while conversation context hydrates. */
export default function AiAssistantPage(): JSX.Element {
  return <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Opening Nexa AI…</div>}><AiAssistant /></Suspense>;
}
