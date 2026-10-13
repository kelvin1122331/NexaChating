'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BellOff, Check, Copy, Image as ImageIcon, Link2, LockKeyhole, MoreHorizontal, Pin, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chat-store';

/** Conversation profile, member list and quick privacy controls. */
export default function ConversationInfoPage(): JSX.Element {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();
  const id = params.conversationId;
  const conversation = useChatStore((state) => state.conversations.find((item) => item.id === id));
  const togglePinned = useChatStore((state) => state.togglePinned);
  const toggleMuted = useChatStore((state) => state.toggleMuted);
  const messages = useChatStore((state) => state.messagesByConversation[id] ?? []);

  if (!conversation) return <div className="grid h-full place-items-center p-8 text-sm text-muted">Conversation not found.</div>;
  const group = conversation.type === 'group' || conversation.type === 'channel';
  const shareInvite = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/chat/${id}`);
      toast.success('Invite link copied');
    } catch {
      toast.error('Unable to copy invite link.');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-10 flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur md:px-7">
        <button onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Back to conversation"><ArrowLeft size={19} /></button>
        <h1 className="text-sm font-semibold">Conversation details</h1>
      </header>
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-7 md:px-8 md:pt-10">
        <div className="flex flex-col items-center rounded-3xl border border-line bg-panel px-5 py-7 text-center shadow-card">
          <Avatar name={conversation.title} initials={conversation.initials} color={conversation.avatarColor} size="xl" online={conversation.isOnline} />
          <h2 className="mt-4 text-xl font-semibold">{conversation.title}</h2>
          <p className="mt-1 text-xs text-muted">{group ? `${conversation.members.length || 8} members` : conversation.isOnline ? 'online now' : conversation.subtitle}</p>
          {conversation.subtitle && group ? <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{conversation.subtitle}</p> : null}
          <div className="mt-5 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => toggleMuted(id)}><BellOff size={14} />{conversation.isMuted ? 'Unmute' : 'Mute'}</Button>
            <Button variant="secondary" size="sm" onClick={() => togglePinned(id)}><Pin size={14} />{conversation.isPinned ? 'Unpin' : 'Pin'}</Button>
            <Button variant="outline" size="sm" onClick={shareInvite}><Link2 size={14} />Invite</Button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-panel shadow-card">
          <Link href={`/chat/${id}/media`} className="flex min-h-[60px] items-center gap-3 border-b border-line px-4 transition hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><ImageIcon size={17} /></span><span className="flex-1 text-sm font-medium">Shared media</span><span className="text-xs text-muted">{messages.filter((message) => ['image', 'video', 'document'].includes(message.type)).length}</span></Link>
          <button onClick={() => toast('Search is available from the conversation header.')} className="flex min-h-[60px] w-full items-center gap-3 border-b border-line px-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300"><Search size={17} /></span><span className="flex-1 text-sm font-medium">Search in conversation</span><span className="text-xs text-slate-400">⌕</span></button>
          <div className="flex min-h-[60px] items-center gap-3 px-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck size={17} /></span><span className="flex-1 text-sm font-medium">End-to-end encryption</span><span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600"><Check size={12} /> Active</span></div>
        </div>

        {group ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-panel shadow-card">
            <div className="flex min-h-[56px] items-center justify-between border-b border-line px-4"><div className="flex items-center gap-2"><UsersRound size={16} className="text-brand-600" /><h3 className="text-sm font-semibold">People</h3><span className="text-xs text-muted">{conversation.members.length || 8}</span></div><button onClick={shareInvite} className="text-xs font-semibold text-brand-600">Add people</button></div>
            {conversation.members.map((person) => (
              <div key={person.id} className="flex min-h-[62px] items-center gap-3 px-4"><Avatar name={person.displayName} initials={person.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)} size="sm" color="from-sky-200 to-indigo-200" online={person.isOnline} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{person.displayName}</p><p className="mt-0.5 text-[10px] text-muted">@{person.username}</p></div>{person.role === 'admin' || person.role === 'owner' ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[9px] font-semibold text-brand-700 dark:bg-indigo-950/40 dark:text-indigo-300">{person.role}</span> : null}</div>
            ))}
          </div>
        ) : null}

        <button onClick={shareInvite} className="mt-5 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-panel px-4 text-left shadow-card transition hover:border-brand-200"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Copy size={16} /></span><span className="flex-1"><span className="block text-sm font-medium">Share chat invite</span><span className="mt-0.5 block text-[10px] text-muted">Invite someone into the conversation</span></span><MoreHorizontal size={16} className="text-slate-400" /></button>
        <div className="mt-4 flex items-center gap-2 px-2 text-[10px] text-muted"><LockKeyhole size={13} /> Messages are private to members of this conversation.</div>
      </div>
    </section>
  );
}
