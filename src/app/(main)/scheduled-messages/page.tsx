'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Clock3, MessageCircle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/stores/chat-store';

interface ScheduledMessage {
  id: string;
  conversation_id: string;
  content: string;
  type: string;
  scheduled_at: string;
  created_at: string;
}

interface ScheduledMessagesResponse {
  messages?: ScheduledMessage[];
  error?: string;
}

function localDateTimeMinimum(): string {
  const date = new Date(Date.now() + 60_000);
  date.setSeconds(0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Lists, creates, and cancels authenticated scheduled text messages. */
export default function ScheduledMessagesPage(): JSX.Element {
  const conversations = useChatStore((state) => state.conversations);
  const backendMode = useChatStore((state) => state.backendMode);
  const workspaceReady = useChatStore((state) => state.workspaceReady);
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [content, setContent] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(localDateTimeMinimum);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateMinimum = useMemo(() => localDateTimeMinimum(), []);
  const selectedConversationId = conversationId || conversations[0]?.id || '';

  const refresh = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (!backendMode) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/messages/schedule', { cache: 'no-store', signal });
      const result = await response.json() as ScheduledMessagesResponse;
      if (!response.ok) throw new Error(result.error || 'Scheduled messages could not be loaded.');
      setMessages(result.messages ?? []);
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
      setError(fetchError instanceof Error ? fetchError.message : 'Scheduled messages could not be loaded.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [backendMode]);

  useEffect(() => {
    if (!backendMode) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => refresh(controller.signal));
    return () => controller.abort();
  }, [backendMode, refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const cleanContent = content.trim();
    if (!backendMode) {
      toast.error('Connect a Supabase project to schedule messages to your account.');
      return;
    }
    if (!selectedConversationId) {
      toast.error('Choose a conversation first.');
      return;
    }
    const scheduledDate = new Date(scheduledAt);
    if (!cleanContent || cleanContent.length > 20_000 || !Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() + 60_000) {
      toast.error('Choose a future time at least one minute from now and enter a message.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConversationId, content: cleanContent, scheduledAt: scheduledDate.toISOString() }),
      });
      const result = await response.json() as { message?: ScheduledMessage; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error || 'The message could not be scheduled.');
      setMessages((current) => [...current, result.message!].sort((left, right) => Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at)));
      setContent('');
      setScheduledAt(localDateTimeMinimum());
      toast.success('Message scheduled.');
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'The message could not be scheduled.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (message: ScheduledMessage): Promise<void> => {
    setMessages((current) => current.filter((item) => item.id !== message.id));
    try {
      const response = await fetch(`/api/messages/schedule/${encodeURIComponent(message.id)}`, { method: 'DELETE' });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The scheduled message could not be cancelled.');
      toast.success('Scheduled message cancelled.');
    } catch (cancelError) {
      setMessages((current) => [...current, message].sort((left, right) => Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at)));
      toast.error(cancelError instanceof Error ? cancelError.message : 'The scheduled message could not be cancelled.');
    }
  };

  const conversationName = (id: string): string => {
    const conversation = conversations.find((item) => item.id === id);
    return conversation?.title || conversation?.members.map((member) => member.displayName).join(', ') || 'Conversation';
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex min-h-[76px] shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3 md:px-8">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><CalendarClock size={19} /></span><div><h1 className="text-base font-semibold">Scheduled messages</h1><p className="mt-0.5 text-[11px] text-muted">Write now. Send at the right moment.</p></div></div>
        <Button variant="outline" onClick={() => void refresh()} disabled={!backendMode || loading} aria-label="Refresh scheduled messages"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</Button>
      </header>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          <section aria-labelledby="scheduled-list-heading" className="rounded-3xl border border-line bg-panel p-5 shadow-card md:p-6">
            <div className="flex items-center justify-between gap-3"><div><h2 id="scheduled-list-heading" className="text-sm font-semibold">Upcoming</h2><p className="mt-1 text-[11px] text-muted">Messages stay private until they are sent.</p></div><Badge tone="neutral">{messages.length}</Badge></div>
            {error ? <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => void refresh()}>Try again</Button></div> : null}
            {loading && messages.length === 0 ? <div role="status" aria-label="Loading scheduled messages" className="mt-5 space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div> : null}
            {!loading && !error && messages.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-line px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><Clock3 size={19} /></span><h3 className="mt-3 text-sm font-semibold">Nothing scheduled yet</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">Choose a conversation, write a message, and set the time you want it delivered.</p>{!backendMode && workspaceReady ? <p className="mt-4 text-[10px] text-amber-700 dark:text-amber-300">Connect Supabase to save scheduled messages to an account.</p> : null}</div> : null}
            <ul className="mt-5 space-y-3">
              {messages.map((message) => <li key={message.id} className="rounded-2xl border border-line bg-canvas/60 p-4">
                <div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><MessageCircle size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{conversationName(message.conversation_id)}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted">{message.content}</p><p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-violet-600 dark:text-violet-300"><Clock3 size={12} />{format(parseISO(message.scheduled_at), 'EEE, MMM d · h:mm a')}</p></div><button type="button" aria-label={`Cancel scheduled message to ${conversationName(message.conversation_id)}`} onClick={() => void cancel(message)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button></div>
              </li>)}
            </ul>
          </section>

          <section aria-labelledby="schedule-form-heading" className="h-fit rounded-3xl border border-line bg-panel p-5 shadow-card md:p-6">
            <div><h2 id="schedule-form-heading" className="text-sm font-semibold">Schedule a message</h2><p className="mt-1 text-[11px] text-muted">You can cancel it any time before delivery.</p></div>
            <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Conversation</span><select aria-label="Conversation" value={selectedConversationId} onChange={(event) => setConversationId(event.target.value)} disabled={!conversations.length} className="h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none focus:border-brand-300 disabled:opacity-60"><option value="">{conversations.length ? 'Choose a conversation' : 'No conversations available'}</option>{conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title || conversation.members.map((member) => member.displayName).join(', ') || 'Conversation'}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Message</span><textarea aria-label="Message" value={content} onChange={(event) => setContent(event.target.value)} rows={5} maxLength={20_000} required placeholder="Write your message…" className="w-full resize-y rounded-xl border border-line bg-panel px-3.5 py-3 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10" /><span className="mt-1 block text-right text-[10px] text-muted">{content.length.toLocaleString()} / 20,000</span></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Send at</span><Input type="datetime-local" min={dateMinimum} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label>
              <Button type="submit" className="w-full" loading={saving} disabled={!backendMode || !selectedConversationId || !content.trim()}><CalendarClock size={15} /> Schedule message</Button>
              {!backendMode && workspaceReady ? <p className="text-center text-[10px] leading-5 text-muted">Sign in to a configured Supabase workspace to store and send scheduled messages.</p> : null}
            </form>
            {conversations.length === 0 ? <Link href="/chat/new" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-line text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-indigo-950/30">Start a conversation first</Link> : null}
          </section>
        </div>
      </div>
    </section>
  );
}
