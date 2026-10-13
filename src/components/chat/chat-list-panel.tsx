'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Archive, BellOff, Check, CheckCheck, ChevronDown, CirclePlus, Inbox, MoreHorizontal,
  Pin, Search, Settings2, Sparkles, X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { formatConversationTime } from '@/lib/utils/format-date';
import { useChatStore } from '@/stores/chat-store';
import type { ConversationSummary, FolderId } from '@/lib/types/conversation';

const tabs: Array<{ id: FolderId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'community', label: 'Community' },
  { id: 'ai_tools', label: 'AI tools' },
];

function ConversationActions({ conversation }: { conversation: ConversationSummary }): JSX.Element {
  const togglePinned = useChatStore((state) => state.togglePinned);
  const toggleMuted = useChatStore((state) => state.toggleMuted);
  const archive = useChatStore((state) => state.archiveConversation);
  const markRead = useChatStore((state) => state.markConversationRead);
  const markUnread = useChatStore((state) => state.markConversationUnread);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label={`Actions for ${conversation.title}`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 opacity-100 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-white">
          <MoreHorizontal size={17} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={6} align="end" className="z-[70] min-w-[190px] rounded-2xl border border-line bg-panel p-1.5 shadow-soft data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DropdownMenu.Item onSelect={() => togglePinned(conversation.id)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800">
            <Pin size={15} className="text-slate-400" /> {conversation.isPinned ? 'Unpin chat' : 'Pin chat'}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => toggleMuted(conversation.id)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800">
            <BellOff size={15} className="text-slate-400" /> {conversation.isMuted ? 'Unmute notifications' : 'Mute notifications'}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => conversation.unreadCount ? markRead(conversation.id) : markUnread(conversation.id)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800">
            {conversation.unreadCount ? <CheckCheck size={15} className="text-slate-400" /> : <Check size={15} className="text-slate-400" />}
            Mark as {conversation.unreadCount ? 'read' : 'unread'}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={() => archive(conversation.id)} className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm text-rose-600 outline-none hover:bg-rose-50 focus:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">
            <Archive size={15} /> Archive chat
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ConversationRow({ conversation, active }: { conversation: ConversationSummary; active: boolean }): JSX.Element {
  return (
    <article className={cn('group relative flex min-h-[78px] items-center gap-3 rounded-2xl px-3 py-2 transition-colors', active ? 'bg-brand-50/90 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70')}>
      <Link href={`/chat/${conversation.id}`} className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-500" aria-label={`Open chat with ${conversation.title}`} />
      <Avatar name={conversation.title} initials={conversation.initials} size="lg" color={conversation.avatarColor} online={conversation.isOnline} />
      <div className="pointer-events-none min-w-0 flex-1 self-stretch py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className={cn('truncate text-[13px] font-semibold', active ? 'text-brand-800 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-100')}>{conversation.title}</h3>
            {conversation.type === 'channel' ? <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">Channel</span> : null}
          </div>
          <time className={cn('shrink-0 text-[10px]', conversation.unreadCount ? 'font-semibold text-brand-600 dark:text-indigo-300' : 'text-slate-400')} dateTime={conversation.lastMessageAt}>{formatConversationTime(conversation.lastMessageAt)}</time>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className={cn('min-w-0 truncate text-[12px] leading-5', conversation.unreadCount ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400')}>
            {conversation.isTyping ? <span className="font-medium text-emerald-600">typing…</span> : conversation.lastMessage}
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            {conversation.isPinned ? <Pin size={12} className="text-slate-400" aria-label="Pinned" /> : null}
            {conversation.isMuted ? <BellOff size={12} className="text-slate-400" aria-label="Muted" /> : null}
            {conversation.unreadCount > 0 ? <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span> : null}
          </span>
        </div>
      </div>
      <div className="relative z-10 -mr-1"><ConversationActions conversation={conversation} /></div>
    </article>
  );
}

/** Inbox rail with searchable conversations, quick filters and per-chat actions. */
export function ChatListPanel(): JSX.Element {
  const pathname = usePathname();
  const conversations = useChatStore((state) => state.conversations);
  const messages = useChatStore((state) => state.messagesByConversation);
  const activeFolder = useChatStore((state) => state.activeFolder);
  const setActiveFolder = useChatStore((state) => state.setActiveFolder);
  const storeSearch = useChatStore((state) => state.searchQuery);
  const setSearchQuery = useChatStore((state) => state.setSearchQuery);
  const user = useChatStore((state) => state.user);
  const [showArchived, setShowArchived] = useState(false);
  const [localQuery, setLocalQuery] = useState(storeSearch);

  const visibleConversations = useMemo(() => {
    const query = localQuery.trim().toLowerCase();
    return conversations
      .filter((conversation) => showArchived ? conversation.isArchived : !conversation.isArchived)
      .filter((conversation) => {
        if (activeFolder === 'unread') return conversation.unreadCount > 0;
        if (activeFolder !== 'all') return conversation.tags.includes(activeFolder);
        return true;
      })
      .filter((conversation) => {
        if (!query) return true;
        const messageMatch = (messages[conversation.id] ?? []).some((message) => message.content.toLowerCase().includes(query));
        return conversation.title.toLowerCase().includes(query)
          || conversation.lastMessage.toLowerCase().includes(query)
          || messageMatch;
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  }, [activeFolder, conversations, localQuery, messages, showArchived]);

  const unreadTotal = conversations.reduce((sum, conversation) => sum + (conversation.isArchived ? 0 : conversation.unreadCount), 0);
  const activeConversationId = pathname.match(/^\/chat\/([^/]+)/)?.[1];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-panel">
      <div className="px-5 pb-4 pt-[max(20px,var(--safe-top))] md:px-5 md:pt-6">
        <div className="flex items-center justify-between">
          <Link href="/chat" className="flex items-center gap-2.5 rounded-xl" aria-label="NexaChat inbox">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/20"><Sparkles size={18} fill="currentColor" /></span>
            <div>
              <p className="text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">NexaChat</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-400">Chat smarter. Do more.</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/settings" className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Open settings"><Settings2 size={18} /></Link>
            <Link href="/chat/new" className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600" aria-label="Start a new chat"><CirclePlus size={19} /></Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h1 className="text-[21px] font-semibold tracking-tight">Messages</h1>
            <p className="mt-0.5 text-xs text-muted">A little more connected.</p>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Avatar name={user.displayName} initials="AM" size="sm" color="from-indigo-300 to-violet-200" />
              <ChevronDown size={13} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={6} align="end" className="z-50 min-w-44 rounded-2xl border border-line bg-panel p-1.5 shadow-soft">
                <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold">{user.displayName}</DropdownMenu.Label>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item onSelect={() => setShowArchived((value) => !value)} className="flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Archive size={15} /> {showArchived ? 'Back to inbox' : 'Archived chats'}</DropdownMenu.Item>
                <DropdownMenu.Item className="flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Inbox size={15} /> {unreadTotal} unread messages</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="relative mt-4">
          <Input
            aria-label="Search conversations and messages"
            placeholder="Search messages or people"
            value={localQuery}
            onChange={(event) => { setLocalQuery(event.target.value); setSearchQuery(event.target.value); }}
            leadingIcon={<Search size={16} />}
            className="h-11 rounded-2xl border-transparent bg-slate-100/80 text-[12px] placeholder:text-slate-400 focus:border-brand-300 dark:bg-slate-800/80"
            type="search"
          />
          {localQuery ? <button onClick={() => { setLocalQuery(''); setSearchQuery(''); }} className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-slate-400" aria-label="Clear search"><X size={14} /></button> : null}
        </div>
      </div>

      <div className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-line px-4 pb-3" role="tablist" aria-label="Chat folders">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeFolder === tab.id} onClick={() => setActiveFolder(tab.id)}
            className={cn('min-h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold transition-colors', activeFolder === tab.id ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/15' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')}>
            {tab.label}{tab.id === 'unread' && unreadTotal > 0 ? <span className="ml-1.5 opacity-80">{unreadTotal}</span> : null}
          </button>
        ))}
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-2">
        {showArchived ? <div className="mb-2 flex items-center justify-between px-2 py-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Archived chats</span><button onClick={() => setShowArchived(false)} className="text-xs text-brand-600">Close</button></div> : null}
        {!showArchived && activeFolder === 'all' && !localQuery ? (
          <div className="mb-2 flex items-center gap-1.5 px-2 pt-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400"><Pin size={11} fill="currentColor" /> Pinned</div>
        ) : null}
        <div className="space-y-1">
          {visibleConversations.map((conversation, index) => (
            <div key={conversation.id}>
              {!showArchived && activeFolder === 'all' && !localQuery && index > 0 && index === visibleConversations.findIndex((item) => !item.isPinned) ? (
                <div className="mb-2 mt-4 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400"><span className="h-px flex-1 bg-line" />Recent<span className="h-px flex-1 bg-line" /></div>
              ) : null}
              <ConversationRow conversation={conversation} active={activeConversationId === conversation.id} />
            </div>
          ))}
        </div>
        {visibleConversations.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Search size={20} /></span>
            <p className="mt-4 text-sm font-semibold">No conversations found</p>
            <p className="mt-1 max-w-[220px] text-xs leading-5 text-muted">Try a different search or choose another folder.</p>
            {localQuery ? <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setLocalQuery(''); setSearchQuery(''); }}>Clear search</Button> : null}
          </div>
        ) : null}
      </div>

      <div className="hidden items-center gap-2 border-t border-line px-5 py-3 md:flex">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-[11px] text-slate-500">All caught up with your people</p>
      </div>
    </div>
  );
}
