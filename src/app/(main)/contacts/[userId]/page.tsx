'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, MessageCircle, MoreHorizontal, Phone, Share2, ShieldCheck, Star, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chat-store';
import { nativeShare } from '@/lib/median/share';

/** Contact detail card, quick-chat actions, and privacy controls. */
export default function ContactProfilePage(): JSX.Element {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const contact = useChatStore((state) => state.conversations.find((item) => item.id === params.userId));
  const togglePinned = useChatStore((state) => state.togglePinned);
  const toggleBlocked = useChatStore((state) => state.toggleBlocked);

  if (!contact) return <div className="grid h-full place-items-center p-8 text-sm text-muted">Contact not found.</div>;
  const openChat = (): void => router.push(`/chat/${contact.id}`);
  const shareContact = async (): Promise<void> => {
    const contactUrl = `${window.location.origin}/contacts/${contact.id}`;
    const shared = await nativeShare({ title: contact.title, text: `Connect with ${contact.title} on NexaChat`, url: contactUrl });
    if (shared) {
      toast.success('Contact shared');
      return;
    }
    try {
      await navigator.clipboard.writeText(contactUrl);
      toast.success('Contact link copied');
    } catch {
      toast.error('Could not copy this contact link.');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-10 flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur md:px-7"><button onClick={() => router.back()} aria-label="Back to contacts" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={19} /></button><h1 className="text-sm font-semibold">Contact profile</h1><button onClick={() => toast('More contact options')} aria-label="More contact options" className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><MoreHorizontal size={20} /></button></header>
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-7 md:pt-10">
        <div className="rounded-3xl border border-line bg-panel px-5 py-8 text-center shadow-card"><Avatar name={contact.title} initials={contact.initials} color={contact.avatarColor} size="xl" online={contact.isOnline} /><h2 className="mt-4 text-xl font-semibold">{contact.title}</h2><p className="mt-1 text-sm text-muted">@{contact.members[0]?.username ?? contact.id}</p><span className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted"><span className={`h-2 w-2 rounded-full ${contact.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />{contact.isOnline ? 'Online now' : contact.subtitle ?? 'Last seen recently'}</span>
          <div className="mt-6 flex justify-center gap-2"><Button onClick={openChat}><MessageCircle size={16} /> Message</Button><Button variant="secondary" size="icon" onClick={() => toast('Voice calls are ready to connect when calling is enabled.')} aria-label="Call contact"><Phone size={16} /></Button><Button variant="secondary" size="icon" onClick={() => toast('Video calls are ready to connect when calling is enabled.')} aria-label="Video call contact"><Video size={16} /></Button></div>
        </div>
        <div className="mt-4 rounded-3xl border border-line bg-panel p-4 shadow-card"><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-400">About</p><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{contact.subtitle ?? 'Making good things with good people.'}</p></div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-panel shadow-card">
          <Link href={`/chat/${contact.id}/media`} className="flex min-h-[58px] items-center gap-3 border-b border-line px-4 hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300"><ShieldCheck size={16} /></span><span className="flex-1 text-sm font-medium">Shared media</span><span className="text-[10px] text-muted">View</span></Link>
          <button onClick={() => togglePinned(contact.id)} className="flex min-h-[58px] w-full items-center gap-3 border-b border-line px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300"><Star size={16} fill={contact.isPinned ? 'currentColor' : 'none'} /></span><span className="flex-1 text-sm font-medium">{contact.isPinned ? 'Remove from favorites' : 'Add to favorites'}</span></button>
          <button onClick={shareContact} className="flex min-h-[58px] w-full items-center gap-3 border-b border-line px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300"><Share2 size={16} /></span><span className="flex-1 text-sm font-medium">Share contact</span></button>
          <button onClick={() => { toggleBlocked(contact.id); toast.success(contact.isBlocked ? 'Contact unblocked' : 'Contact blocked'); }} className="flex min-h-[58px] w-full items-center gap-3 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"><Ban size={16} /></span><span className="flex-1 text-sm font-medium">{contact.isBlocked ? 'Unblock contact' : 'Block contact'}</span></button>
        </div>
      </div>
    </section>
  );
}
