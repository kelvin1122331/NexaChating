'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot, Check, ChevronDown, Clipboard, Lightbulb, MessageCircle, Plus, SendHorizontal, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageContent } from '@/components/chat/message-content';
import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/lib/utils/cn';

interface AiLine {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  preview?: boolean;
}

const STARTER_PROMPTS = [
  'Help me plan a focused workday',
  'Write a kind follow-up message',
  'Summarize what I missed today',
  'Turn an idea into a clear next step',
];

function previewResponse(prompt: string, context?: string): string {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('summar')) return `Here’s a quick preview summary${context ? ` of ${context}` : ''}:\n\n• The team is aligned on the calmer, more human direction.\n• The onboarding and dashboard work are moving forward.\n• Next step: review the responsive states before the next sync.\n\nConnect your AI provider to generate a live summary from your conversations.`;
  if (normalized.includes('follow-up') || normalized.includes('message')) return 'Here’s a warm starting point:\n\n“Hey! Thanks again for the thoughtful conversation. I’ve had a chance to look through everything and I’m excited about where we’re headed. I’ll share a few next steps soon — talk again soon!”\n\nTell me the tone or context and I can help you refine it.';
  if (normalized.includes('task') || normalized.includes('next step')) return 'A good next step is to make the outcome small and clear:\n\n1. Decide what “done” looks like.\n2. Set aside 25 focused minutes.\n3. Share a quick update with the people who are waiting on you.\n\nWant me to turn that into a task?';
  if (normalized.includes('day') || normalized.includes('plan')) return 'Let’s make room for focused work and a little breathing space:\n\n• Start with one priority that moves the launch forward.\n• Block a 60–90 minute focus session before meetings.\n• Batch quick replies in two short windows.\n• Leave the last 15 minutes to capture tomorrow’s next step.\n\nThis is a preview response. Add your AI configuration for personalized planning.';
  return 'I’m here to help you think it through. In preview mode, I can offer a few starter ideas, help draft a message, or turn a conversation into a next step.\n\nTo enable live, context-aware answers, configure Supabase authentication and a server-side OpenAI API key.';
}

/** Assistant workspace with server-streaming support and a clearly labeled offline preview mode. */
export function AiAssistant(): JSX.Element {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversation');
  const conversation = useChatStore((state) => state.conversations.find((item) => item.id === conversationId));
  const messagesByConversation = useChatStore((state) => state.messagesByConversation);
  const [lines, setLines] = useState<AiLine[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContext, setShowContext] = useState(Boolean(conversation));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamedTextRef = useRef('');

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [isLoading, lines]);

  const submit = async (event?: FormEvent<HTMLFormElement>, text = prompt): Promise<void> => {
    event?.preventDefault();
    const question = text.trim();
    if (!question || isLoading) return;
    const userLine: AiLine = { id: `user-${crypto.randomUUID()}`, role: 'user', content: question };
    const assistantId = `assistant-${crypto.randomUUID()}`;
    setLines((current) => [...current, userLine]);
    setPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...lines, userLine].slice(-20).map(({ role, content }) => ({ role, content })),
          conversationId: showContext ? conversation?.id : undefined,
          context: showContext && conversationId
            ? (messagesByConversation[conversationId] ?? []).slice(-12).map((message) => `${message.senderName}: ${message.content}`).join('\n')
            : undefined,
        }),
      });
      if (response.ok && response.body) {
        setLines((current) => [...current, { id: assistantId, role: 'assistant', content: '' }]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        streamedTextRef.current = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          streamedTextRef.current += decoder.decode(value, { stream: true });
          const snapshot = streamedTextRef.current;
          setLines((current) => current.map((line) => line.id === assistantId ? { ...line, content: snapshot } : line));
        }
        const finalText = streamedTextRef.current.trim();
        if (!finalText) setLines((current) => current.map((line) => line.id === assistantId ? { ...line, content: 'I couldn’t find a response for that. Please try again.' } : line));
      } else {
        const responseText = previewResponse(question, conversation?.title);
        setLines((current) => [...current, { id: assistantId, role: 'assistant', content: responseText, preview: true }]);
      }
    } catch {
      const responseText = previewResponse(question, conversation?.title);
      setLines((current) => [...current, { id: assistantId, role: 'assistant', content: responseText, preview: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const askAboutConversation = (): void => {
    const chatMessages = messagesByConversation[conversationId ?? ''] ?? [];
    const context = chatMessages.slice(-12).map((message) => `${message.senderName}: ${message.content}`).join('\n');
    if (!context) return;
    setShowContext(true);
    setPrompt('Give me a short summary and the next useful step.');
    textareaRef.current?.focus();
  };

  const copyAnswer = async (text: string): Promise<void> => {
    try { await navigator.clipboard.writeText(text); toast.success('Answer copied'); }
    catch { toast.error('Could not copy this answer.'); }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex min-h-[76px] shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3 md:px-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm"><Sparkles size={18} /></span><div><h1 className="text-base font-semibold">Nexa AI</h1><p className="mt-0.5 text-[11px] text-muted">A thoughtful assistant for your day.</p></div></div><div className="flex items-center gap-1.5"><span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-[9px] font-semibold text-amber-700 sm:inline-flex dark:bg-amber-950/40 dark:text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Preview mode</span><button onClick={() => setLines([])} aria-label="Start new AI conversation" className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><Plus size={19} /></button></div></header>

      {conversation ? <button onClick={() => setShowContext((visible) => !visible)} className="flex min-h-12 items-center gap-2 border-b border-line bg-brand-50/70 px-4 text-left text-xs dark:bg-indigo-950/30 md:px-8"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-brand-600 dark:bg-slate-800 dark:text-indigo-300"><MessageCircle size={14} /></span><span className="min-w-0 flex-1 truncate"><span className="font-semibold text-brand-700 dark:text-indigo-200">Chat context:</span> <span className="text-slate-600 dark:text-slate-300">{conversation.title}</span></span><span className="text-[10px] text-brand-600">{showContext ? 'Included' : 'Not included'}</span><ChevronDown size={14} className={cn('text-brand-500 transition-transform', showContext && 'rotate-180')} /></button> : null}

      <div ref={scrollRef} className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-3xl">
          {!lines.length ? (
            <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center sm:py-12">
              <span className="relative grid h-16 w-16 place-items-center rounded-[22px] bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20"><Bot size={27} /><span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-canvas bg-emerald-400 text-white"><Sparkles size={11} /></span></span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[.17em] text-brand-600">Your ideas have a partner</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">What’s on your mind?</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">Draft a thoughtful reply, turn a conversation into a plan, or make a little space to think.</p>
              <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">{STARTER_PROMPTS.map((starter) => <button key={starter} onClick={() => void submit(undefined, starter)} className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-line bg-panel px-3 text-left text-xs font-medium transition hover:border-brand-200 hover:bg-brand-50/60 dark:hover:bg-indigo-950/30"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-indigo-950/60 dark:text-indigo-300"><Lightbulb size={14} /></span><span className="flex-1">{starter}</span><span className="text-slate-300">↗</span></button>)}</div>
              <div className="mt-7 flex items-center gap-2 text-[10px] text-muted"><ShieldCheckIcon /> Your conversations stay yours. Preview responses are generated locally.</div>
            </div>
          ) : (
            <div className="space-y-6">{lines.map((line) => (
              <div key={line.id} className={cn('flex items-start gap-3', line.role === 'user' && 'flex-row-reverse')}>
                {line.role === 'assistant' ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white"><Sparkles size={16} /></span> : <Avatar name="Alex Morgan" initials="AM" size="sm" color="from-indigo-300 to-violet-200" />}
                <div className={cn('max-w-[min(88%,620px)] rounded-3xl px-4 py-3', line.role === 'user' ? 'rounded-tr-md bg-brand-500 text-white' : 'rounded-tl-md border border-line bg-panel text-slate-800 shadow-card dark:text-slate-100')}>
                  {line.preview ? <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Preview reply</span> : null}
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-6"><MessageContent text={line.content} /></div>
                  {line.role === 'assistant' && line.content ? <div className="mt-2 flex items-center justify-end"><button onClick={() => void copyAnswer(line.content)} aria-label="Copy AI response" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] text-muted hover:bg-slate-100 dark:hover:bg-slate-800"><Clipboard size={12} /> Copy</button></div> : null}
                </div>
              </div>
            ))}{isLoading ? <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white"><Sparkles size={16} /></span><div className="flex items-center gap-1 rounded-2xl border border-line bg-panel px-4 py-3"><span className="sr-only">Nexa AI is thinking</span>{[0, 1, 2].map((item) => <span key={item} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${item * 120}ms` }} />)}</div></div> : null}</div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-panel px-3 pb-[max(12px,var(--safe-bottom))] pt-3 md:px-8 md:py-4">
        {conversation && showContext ? <div className="mx-auto mb-2 flex max-w-3xl justify-end"><button onClick={askAboutConversation} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-brand-600 hover:text-brand-700"><WandSparkles size={13} /> Summarize recent chat</button></div> : null}
        <form onSubmit={(event) => void submit(event)} className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-line bg-canvas p-2 pl-4 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10">
          <textarea ref={textareaRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={6_000} aria-label="Ask Nexa AI" placeholder="Ask anything, or bring an idea…" className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" />
          <Button type="submit" size="icon" disabled={!prompt.trim() || isLoading} aria-label="Send prompt" className="h-10 w-10 shrink-0 rounded-2xl"><SendHorizontal size={17} /></Button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[9px] text-slate-400">Nexa AI can make mistakes. Preview mode uses sample responses; review important information.</p>
      </div>
    </section>
  );
}

function ShieldCheckIcon(): JSX.Element {
  return <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={12} /></span>;
}
