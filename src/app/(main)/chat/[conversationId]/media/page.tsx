'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Image as ImageIcon, Play, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useChatStore } from '@/stores/chat-store';
import { formatConversationTime } from '@/lib/utils/format-date';
import { formatFileSize } from '@/lib/utils/format-file-size';
import { cn } from '@/lib/utils/cn';

/** Gallery of images, videos and files shared in a single conversation. */
export default function SharedMediaPage(): JSX.Element {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();
  const conversation = useChatStore((state) => state.conversations.find((item) => item.id === params.conversationId));
  const messages = useChatStore((state) => state.messagesByConversation[params.conversationId] ?? []);
  const media = messages.filter((message) => ['image', 'video', 'document'].includes(message.type)).slice().reverse();

  if (!conversation) return <div className="grid h-full place-items-center text-sm text-muted">Conversation not found.</div>;
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-panel px-4 md:px-7">
        <button onClick={() => router.back()} aria-label="Back to conversation" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={19} /></button>
        <Avatar name={conversation.title} initials={conversation.initials} size="sm" color={conversation.avatarColor} />
        <div><h1 className="text-sm font-semibold">Shared media</h1><p className="mt-0.5 text-[10px] text-muted">{conversation.title}</p></div>
      </header>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
        {media.length ? <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <a key={item.id} href={item.mediaUrl ?? '#'} target={item.type === 'document' ? undefined : '_blank'} rel="noreferrer" download={item.mediaName} onClick={(event) => { if (!item.mediaUrl) event.preventDefault(); }} className="group overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className={cn('relative grid aspect-square place-items-center overflow-hidden', item.type === 'image' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-indigo-950/50 dark:to-slate-800')}>
                {item.type === 'image' && item.mediaUrl ? <NextImage src={item.mediaUrl} alt={item.mediaName ?? 'Shared image'} width={480} height={480} unoptimized loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
                {item.type === 'video' ? <span className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-brand-600 shadow-sm"><Play size={19} fill="currentColor" /></span> : null}
                {item.type === 'document' ? <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm"><FileText size={22} /></span> : null}
                {item.type === 'video' ? <Video size={14} className="absolute bottom-3 right-3 text-white drop-shadow" /> : item.type === 'image' ? <ImageIcon size={14} className="absolute bottom-3 right-3 text-white drop-shadow" /> : null}
              </div>
              <div className="p-3"><p className="truncate text-xs font-semibold">{item.mediaName ?? item.content}</p><p className="mt-1 text-[10px] text-muted">{formatConversationTime(item.createdAt)}{item.mediaSize ? ` · ${formatFileSize(item.mediaSize)}` : ''}</p></div>
            </a>
          ))}
        </div> : <div className="grid h-full place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-panel text-slate-300 shadow-card"><ImageIcon size={23} /></span><h2 className="mt-4 text-sm font-semibold">Nothing shared just yet</h2><p className="mt-1 max-w-xs text-xs leading-5 text-muted">Photos, videos, and documents from this chat will appear here.</p><Link href={`/chat/${params.conversationId}`} className="mt-4 inline-block text-xs font-semibold text-brand-600">Back to conversation</Link></div></div>}
      </div>
    </section>
  );
}
