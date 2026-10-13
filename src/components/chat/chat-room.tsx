'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Archive, Bell, BellOff, Ellipsis, Search, Phone,
  Pin, ShieldCheck, Video, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageList } from '@/components/chat/message-list';
import { MessageComposer } from '@/components/chat/message-composer';
import { cn } from '@/lib/utils/cn';
import { useChatStore } from '@/stores/chat-store';
import type { ChatMessage } from '@/lib/types/message';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function TypingIndicator({ name }: { name: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-5 pb-2 text-[11px] text-muted" aria-live="polite">
      <span className="flex items-center gap-1 rounded-full bg-panel px-3 py-2 shadow-sm">
        <span>{name} is typing</span>
        <span className="ml-1 flex gap-0.5">{[0, 1, 2].map((dot) => <motion.span key={dot} className="h-1 w-1 rounded-full bg-brand-500" animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.7, repeat: Infinity, delay: dot * 0.15 }} />)}</span>
      </span>
    </div>
  );
}

/** Conversation experience with local-first sending, reply actions and safe message search. */
export function ChatRoom({ conversationId }: { conversationId: string }): JSX.Element {
  const router = useRouter();
  const conversation = useChatStore((state) => state.conversations.find((item) => item.id === conversationId));
  const messages = useChatStore((state) => state.messagesByConversation[conversationId] ?? []);
  const markRead = useChatStore((state) => state.markConversationRead);
  const toggleMuted = useChatStore((state) => state.toggleMuted);
  const togglePinned = useChatStore((state) => state.togglePinned);
  const archive = useChatStore((state) => state.archiveConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const setMessageStatus = useChatStore((state) => state.setMessageStatus);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const currentUserName = useChatStore((state) => state.user.displayName);
  const currentUserId = useChatStore((state) => state.user.id);
  const backendMode = useChatStore((state) => state.backendMode);
  const workspaceReady = useChatStore((state) => state.workspaceReady);
  const addTask = useChatStore((state) => state.addTask);
  const updateTask = useChatStore((state) => state.updateTask);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const readMessageIds = useMemo(() => messages.filter((message) => UUID_PATTERN.test(message.id)).slice(-100).map((message) => message.id).join(','), [messages]);

  useEffect(() => {
    markRead(conversationId);
    if (!backendMode || !UUID_PATTERN.test(conversationId) || !readMessageIds) return;
    void fetch('/api/messages/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, messageIds: readMessageIds.split(',') }),
    }).catch((error: unknown) => console.warn('[NexaChat read receipts]', error));
  }, [backendMode, conversationId, markRead, readMessageIds]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.trim().toLowerCase();
    return messages.filter((message) => message.content.toLowerCase().includes(query) || message.senderName.toLowerCase().includes(query));
  }, [messages, searchQuery]);

  if (!conversation && backendMode && !workspaceReady) {
    return <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted" role="status">Loading conversation…</div>;
  }

  if (!conversation) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-brand-50 text-3xl dark:bg-indigo-950/50">💬</span>
        <h1 className="mt-5 text-lg font-semibold">This conversation isn’t available</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted">It may have been archived or removed from this workspace.</p>
        <Button variant="secondary" className="mt-5" onClick={() => router.push('/chat')}><ArrowLeft size={16} /> Back to messages</Button>
      </div>
    );
  }

  const isGroup = conversation.type === 'group' || conversation.type === 'channel';
  const onlineText = conversation.isOnline ? 'online now' : isGroup ? `${conversation.members.length || 8} members` : conversation.subtitle || 'last seen recently';

  const onSend = (content: string, file?: File, voiceDuration?: number): void => {
    if (!content.trim() && !file) return;
    const optimistic = addMessage(conversationId, content, replyTo ?? undefined, file, voiceDuration);
    const replyToId = replyTo && UUID_PATTERN.test(replyTo.id) ? replyTo.id : undefined;
    setReplyTo(null);

    if (!backendMode || !UUID_PATTERN.test(conversationId)) {
      window.setTimeout(() => setMessageStatus(conversationId, optimistic.id, 'read'), 650);
      return;
    }
    if (!navigator.onLine) return;

    void (async () => {
      try {
        let response: Response;
        if (file) {
          const form = new FormData();
          form.set('conversationId', conversationId);
          form.set('content', content);
          form.set('clientMessageId', optimistic.id);
          if (replyToId) form.set('replyToId', replyToId);
          form.set('file', file, file.name);
          response = await fetch('/api/messages/send', { method: 'POST', body: form });
        } else {
          response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId, content, replyToId, clientMessageId: optimistic.id }),
          });
        }
        if (!response.ok) {
          setMessageStatus(conversationId, optimistic.id, 'failed');
          toast.error(response.status === 401 ? 'Sign in again to send this message.' : 'This message could not be sent. Please try again.');
          return;
        }
        const result = await response.json() as { media?: { id?: string; file_name?: string } | null };
        setMessageStatus(conversationId, optimistic.id, 'sent');
        if (result.media?.id) {
          const mediaResponse = await fetch(`/api/media/${encodeURIComponent(result.media.id)}/url`);
          if (mediaResponse.ok) {
            const urls = await mediaResponse.json() as { url?: string };
            if (urls.url) {
              if (optimistic.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(optimistic.mediaUrl);
              updateMessage(conversationId, optimistic.id, { mediaUrl: urls.url, mediaName: result.media.file_name ?? file?.name });
            }
          }
        }
        void fetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: optimistic.id }),
        }).catch((error: unknown) => console.warn('[NexaChat push]', error));
      } catch {
        setMessageStatus(conversationId, optimistic.id, navigator.onLine ? 'failed' : 'sending');
        if (navigator.onLine) toast.error('Network error. The message could not be sent.');
      }
    })();
  };

  const onCreateTask = (message: ChatMessage): void => {
    const task = addTask({
      title: message.content.slice(0, 90) || `Follow up with ${message.senderName}`,
      description: `Created from a message in ${conversation.title}.`,
      status: 'pending',
      priority: 'medium',
      assignee: currentUserName,
      conversationId: UUID_PATTERN.test(conversationId) ? conversationId : undefined,
    });
    if (!backendMode) return;
    void (async () => {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            priority: task.priority,
            conversationId: UUID_PATTERN.test(conversationId) ? conversationId : undefined,
            sourceMessageId: UUID_PATTERN.test(message.id) ? message.id : undefined,
            assigneeId: currentUserId,
          }),
        });
        if (!response.ok) {
          updateTask(task.id, { status: 'pending' });
          toast.error('The task was added locally but could not be saved to your account.');
          return;
        }
        const result = await response.json() as { task?: { id: string; due_date: string | null } };
        if (result.task?.id) updateTask(task.id, { id: result.task.id, dueDate: result.task.due_date ?? undefined });
      } catch {
        toast.error('The task was added locally but could not be saved to your account.');
      }
    })();
  };

  const onAiAction = async (message: ChatMessage, action: 'translate' | 'summarize'): Promise<void> => {
    const endpoint = action === 'translate' ? '/api/ai/translate' : '/api/ai/summarize';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'translate'
          ? { text: message.content, targetLanguage: 'English' }
          : { text: message.content }),
      });
      if (!response.ok) {
        toast('Connect your NexaChat account and AI key to use this action.', { icon: '✨' });
        return;
      }
      const payload = await response.json() as { result?: string; text?: string };
      const result = payload.result ?? payload.text;
      if (result) toast.success(result, { duration: 8_000 });
    } catch {
      toast.error('Nexa AI could not complete that request. Try again in a moment.');
    }
  };

  const goBack = (): void => {
    if (window.history.length > 1) router.back();
    else router.push('/chat');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="z-20 flex min-h-[68px] shrink-0 items-center gap-2 border-b border-line bg-panel/95 px-2 pt-[max(6px,var(--safe-top))] backdrop-blur-xl md:px-5 md:pt-0">
        <button onClick={goBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Back to chats"><ArrowLeft size={20} /></button>
        <Link href={`/chat/${conversationId}/info`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2">
          <Avatar name={conversation.title} initials={conversation.initials} size="md" color={conversation.avatarColor} online={conversation.isOnline} />
          <span className="min-w-0"><span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-semibold">{conversation.title}</span>{conversation.type === 'channel' ? <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Channel</span> : null}</span><span className={cn('mt-0.5 block truncate text-[11px]', conversation.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted')}>{onlineText}</span></span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => setSearchOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Search in conversation"><Search size={18} /></button>
          <button onClick={() => toast('Voice calls are ready to connect when calling is enabled.')} className="hidden h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-brand-600 sm:grid dark:hover:bg-slate-800" aria-label="Start voice call"><Phone size={17} /></button>
          <button onClick={() => toast('Video calls are ready to connect when calling is enabled.')} className="hidden h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-brand-600 sm:grid dark:hover:bg-slate-800" aria-label="Start video call"><Video size={18} /></button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild><button className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="More conversation options"><Ellipsis size={21} /></button></DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={6} align="end" className="z-[80] min-w-[210px] rounded-2xl border border-line bg-panel p-1.5 shadow-soft">
                <DropdownMenu.Item onSelect={() => toggleMuted(conversationId)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800">{conversation.isMuted ? <Bell size={15} /> : <BellOff size={15} />}{conversation.isMuted ? 'Unmute notifications' : 'Mute notifications'}</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => togglePinned(conversationId)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Pin size={15} />{conversation.isPinned ? 'Unpin chat' : 'Pin chat'}</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setSearchOpen(true)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Search size={15} />Search in chat</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => router.push(`/chat/${conversationId}/info`)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><ShieldCheck size={15} />Conversation details</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item onSelect={() => { archive(conversationId); router.push('/chat'); }} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm text-rose-600 outline-none hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"><Archive size={15} />Archive conversation</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {searchOpen ? (
        <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2">
          <Input aria-label="Search in this chat" placeholder="Find a message…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} leadingIcon={<Search size={15} />} className="h-9 rounded-xl text-xs" autoFocus />
          <span className="shrink-0 text-[10px] text-muted">{filteredMessages.length} found</span>
          <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label="Close message search" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
        </div>
      ) : null}

      <div className="chat-wallpaper flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageList messages={filteredMessages} onReply={setReplyTo} onCreateTask={onCreateTask} onAiAction={onAiAction} />
          {conversation.isTyping ? <TypingIndicator name={conversation.title} /> : null}
        </div>
      </div>
      <MessageComposer
        onSend={onSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onAskAI={() => router.push(`/ai-assistant?conversation=${encodeURIComponent(conversationId)}`)}
      />
    </div>
  );
}
