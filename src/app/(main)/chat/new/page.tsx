'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCheck, ContactRound, Plus, Search, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

/** Contact picker for starting a personal conversation or assembling a small group. */
export default function NewChatPage(): JSX.Element {
  const router = useRouter();
  const conversations = useChatStore((state) => state.conversations);
  const createConversation = useChatStore((state) => state.createConversation);
  const backendMode = useChatStore((state) => state.backendMode);
  const userId = useChatStore((state) => state.user.id);
  const [query, setQuery] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const contacts = useMemo(() => conversations.filter((conversation) => conversation.type === 'personal' && conversation.id !== 'nexa-ai'), [conversations]);
  const filtered = contacts.filter((contact) => contact.title.toLowerCase().includes(query.toLowerCase()));

  const openContact = (conversationId: string, name: string): void => {
    const existing = conversations.find((conversation) => conversation.id === conversationId);
    if (existing) router.push(`/chat/${existing.id}`);
    else router.push(`/chat/${createConversation(name)}`);
  };

  const toggleSelected = (id: string): void => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const createGroup = async (): Promise<void> => {
    const selectedContacts = contacts.filter((contact) => selected.includes(contact.id));
    const selectedNames = selectedContacts.map((contact) => contact.title);
    const title = window.prompt('Give your group a name', selectedNames.slice(0, 2).join(' & '));
    if (!title?.trim()) return;
    if (!backendMode) {
      const id = createConversation(title.trim(), 'group');
      router.push(`/chat/${id}`);
      return;
    }
    const participantUserIds = selectedContacts.map((contact) => contact.members.find((member) => member.id !== userId)?.id).filter((id): id is string => Boolean(id));
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'group', title: title.trim(), participantUserIds }),
      });
      if (!response.ok) {
        toast.error('The group could not be created. Check the selected contacts and try again.');
        return;
      }
      const result = await response.json() as { conversationId: string };
      router.push(`/chat/${result.conversationId}`);
    } catch {
      toast.error('A network error prevented the group from being created.');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-panel md:border-l md:border-line">
      <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-line px-4 md:px-6">
        <button onClick={() => router.push('/chat')} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Back to messages"><ArrowLeft size={19} /></button>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><ContactRound size={18} /></span>
        <div className="min-w-0 flex-1"><h1 className="text-sm font-semibold">New conversation</h1><p className="mt-0.5 text-[11px] text-muted">Find someone to say hello to.</p></div>
        <Button size="sm" variant={groupMode ? 'primary' : 'outline'} onClick={() => { setGroupMode((mode) => !mode); setSelected([]); }}><UsersRound size={15} /> Group</Button>
      </header>
      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col px-4 py-5 md:px-8 md:py-8">
        <Input aria-label="Search contacts" placeholder="Search your contacts" leadingIcon={<Search size={16} />} value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-2xl bg-slate-50 dark:bg-slate-800" />
        <div className="mt-5 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">{groupMode ? 'Choose people' : 'Recent contacts'}</h2>{groupMode ? <span className="text-xs text-muted">{selected.length} selected</span> : null}</div>
        <div className="scrollbar-none mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {filtered.map((contact) => {
            const isSelected = selected.includes(contact.id);
            return (
              <button key={contact.id} onClick={() => groupMode ? toggleSelected(contact.id) : openContact(contact.id, contact.title)} className={cn('flex min-h-[68px] w-full items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800', isSelected && 'bg-brand-50 dark:bg-indigo-950/40')}>
                <Avatar name={contact.title} initials={contact.initials} color={contact.avatarColor} size="md" online={contact.isOnline} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{contact.title}</span><span className="mt-1 block truncate text-xs text-muted">{contact.subtitle ?? (contact.isOnline ? 'online now' : 'NexaChat contact')}</span></span>
                {groupMode ? <span className={cn('grid h-6 w-6 place-items-center rounded-full border transition', isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 text-transparent dark:border-slate-600')}><Check size={13} /></span> : <span className="grid h-9 w-9 place-items-center rounded-xl text-slate-300"><CheckCheck size={16} /></span>}
              </button>
            );
          })}
          {filtered.length === 0 ? <div className="py-14 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Search size={18} /></span><p className="mt-3 text-sm font-semibold">No contacts found</p><p className="mt-1 text-xs text-muted">Try searching with a different name.</p></div> : null}
        </div>
        {groupMode ? <Button disabled={selected.length < 2} onClick={createGroup} className="mt-4 w-full"><Plus size={16} /> Create group with {selected.length || '…'} people</Button> : null}
      </div>
    </section>
  );
}
