'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ContactRound, Plus, Search, Smartphone, Star, UserPlus, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/stores/chat-store';

/** Searchable contact directory with favorite and add-contact actions. */
export default function ContactsPage(): JSX.Element {
  const router = useRouter();
  const conversations = useChatStore((state) => state.conversations);
  const createConversation = useChatStore((state) => state.createConversation);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [contactName, setContactName] = useState('');

  const contacts = useMemo(() => conversations
    .filter((conversation) => conversation.type === 'personal' && conversation.id !== 'nexa-ai')
    .filter((conversation) => !favoritesOnly || conversation.isPinned)
    .filter((conversation) => conversation.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title)), [conversations, favoritesOnly, query]);

  const addContact = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const name = contactName.trim();
    if (!name) return;
    const existing = conversations.find((conversation) => conversation.title.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? createConversation(name);
    setContactName('');
    setAddOpen(false);
    toast.success(`${name} added to your contacts`);
    router.push(`/contacts/${id}`);
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex min-h-[76px] shrink-0 items-center justify-between border-b border-line bg-panel px-4 py-3 md:px-8">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><ContactRound size={19} /></span><div><h1 className="text-base font-semibold">Contacts</h1><p className="mt-0.5 text-[11px] text-muted">Your people, all together.</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => toast('Contact sync is available in the NexaChat mobile app.')} className="hidden sm:inline-flex"><Smartphone size={15} /> Sync contacts</Button><Button size="sm" onClick={() => setAddOpen((open) => !open)}><UserPlus size={15} /> Add contact</Button></div>
      </header>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl">
          {addOpen ? <form onSubmit={addContact} className="mb-5 flex flex-col gap-3 rounded-3xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center dark:border-indigo-900 dark:bg-indigo-950/25"><div className="min-w-0 flex-1"><label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold">Name or NexaChat username</label><Input id="contact-name" autoFocus placeholder="e.g. Taylor Reed" value={contactName} onChange={(event) => setContactName(event.target.value)} /></div><Button type="submit" className="sm:mt-5"><Plus size={15} /> Add to contacts</Button></form> : null}
          <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Search contacts" placeholder="Search people" leadingIcon={<Search size={16} />} value={query} onChange={(event) => setQuery(event.target.value)} className="flex-1 bg-panel" /><button onClick={() => setFavoritesOnly((only) => !only)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${favoritesOnly ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'border-line bg-panel text-muted hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />Favorites</button></div>
          <div className="mt-6 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[.13em] text-slate-400">{contacts.length} contacts</h2><span className="flex items-center gap-1.5 text-[10px] text-muted"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {contacts.filter((person) => person.isOnline).length} online</span></div>
          {contacts.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {contacts.map((contact) => (
              <Link key={contact.id} href={`/contacts/${contact.id}`} className="group flex min-h-[82px] items-center gap-3 rounded-2xl border border-line bg-panel p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
                <Avatar name={contact.title} initials={contact.initials} color={contact.avatarColor} size="lg" online={contact.isOnline} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{contact.title}</span><span className="mt-1 block truncate text-xs text-muted">{contact.subtitle ?? (contact.isOnline ? 'online now' : 'NexaChat contact')}</span></span>
                {contact.isPinned ? <Star size={14} fill="currentColor" className="text-amber-400" aria-label="Favorite" /> : null}<ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            ))}
          </div> : <div className="mt-8 rounded-3xl border border-dashed border-line bg-panel/60 px-6 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><UsersRound size={20} /></span><h2 className="mt-4 text-sm font-semibold">No contacts match that search</h2><p className="mt-1 text-xs text-muted">Try another name or add someone new.</p></div>}
        </div>
      </div>
    </section>
  );
}
