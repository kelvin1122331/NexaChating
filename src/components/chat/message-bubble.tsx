'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check, CheckCheck, Clock3, Copy, FileText, Forward, MoreHorizontal, Play, Pause,
  Reply, Sparkles, Star, Volume2, XCircle, ListTodo,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/cn';
import { formatFileSize } from '@/lib/utils/format-file-size';
import { formatMessageTime } from '@/lib/utils/format-date';
import { triggerHaptic } from '@/lib/median/haptics';
import { MessageContent } from '@/components/chat/message-content';
import { useChatStore } from '@/stores/chat-store';
import type { ChatMessage } from '@/lib/types/message';

const QUICK_REACTIONS = ['❤️', '😂', '👍', '✨', '🙌'];

function DeliveryStatus({ status }: { status: ChatMessage['status'] }): JSX.Element {
  if (status === 'sending') return <Clock3 size={12} className="text-current/55" aria-label="Sending" />;
  if (status === 'failed') return <XCircle size={12} className="text-rose-500" aria-label="Failed to send" />;
  if (status === 'sent') return <Check size={13} className="text-current/60" aria-label="Sent" />;
  if (status === 'delivered') return <CheckCheck size={13} className="text-current/60" aria-label="Delivered" />;
  return <CheckCheck size={13} className="text-sky-200" aria-label="Read" />;
}

function VoiceNote({ message, outgoing }: { message: ChatMessage; outgoing: boolean }): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(Number(message.metadata?.duration ?? 18));
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const progress = duration > 0 ? elapsed / duration : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const syncDuration = (): void => { if (Number.isFinite(audio.duration)) setDuration(audio.duration); };
    const syncTime = (): void => setElapsed(audio.currentTime);
    const onEnded = (): void => setPlaying(false);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [message.mediaUrl]);

  useEffect(() => {
    if (message.mediaUrl || !playing) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + speed >= duration) {
          window.setTimeout(() => setPlaying(false), 0);
          return 0;
        }
        return current + speed;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [duration, message.mediaUrl, playing, speed]);

  const togglePlayback = async (): Promise<void> => {
    if (!message.mediaUrl || !audioRef.current) {
      setPlaying((value) => !value);
      return;
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    audioRef.current.playbackRate = speed;
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      toast.error('This voice note could not be played.');
    }
  };

  const cycleSpeed = (): void => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  return (
    <div className="flex min-w-[220px] items-center gap-3 py-1">
      {message.mediaUrl ? <audio ref={audioRef} src={message.mediaUrl} preload="metadata" /> : null}
      <button onClick={() => void togglePlayback()} aria-label={playing ? 'Pause voice note' : 'Play voice note'} className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', outgoing ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-600 dark:bg-indigo-950/60 dark:text-indigo-300')}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 items-center gap-[3px]" aria-label="Voice note waveform">
          {Array.from({ length: 34 }, (_, index) => {
            const barHeight = 6 + ((index * 17 + 11) % 17);
            return <span key={index} className={cn('w-[3px] rounded-full transition-colors', index / 34 <= progress ? (outgoing ? 'bg-white' : 'bg-brand-500') : outgoing ? 'bg-white/35' : 'bg-slate-300 dark:bg-slate-600')} style={{ height: `${barHeight}px` }} />;
          })}
        </div>
        <div className={cn('mt-0.5 flex items-center justify-between text-[10px]', outgoing ? 'text-white/70' : 'text-slate-400')}>
          <span>{Math.floor(elapsed / 60)}:{`${Math.floor(elapsed % 60)}`.padStart(2, '0')} / {Math.floor(duration / 60)}:{`${Math.floor(duration % 60)}`.padStart(2, '0')}</span>
          <button onClick={cycleSpeed} aria-label={`Playback speed ${speed} times`} className="rounded px-1.5 py-0.5 font-semibold hover:bg-black/5 dark:hover:bg-white/10">{speed}×</button>
        </div>
      </div>
      <Volume2 size={15} className={cn('shrink-0', outgoing ? 'text-white/55' : 'text-slate-400')} />
    </div>
  );
}

export interface MessageBubbleProps {
  message: ChatMessage;
  onReply: (message: ChatMessage) => void;
  onCreateTask: (message: ChatMessage) => void;
  onAiAction: (message: ChatMessage, action: 'translate' | 'summarize') => void;
}

/** A chat message with accessible delivery state, reactions, reply quotes and actions. */
export function MessageBubble({ message, onReply, onCreateTask, onAiAction }: MessageBubbleProps): JSX.Element {
  const toggleStarred = useChatStore((state) => state.toggleStarred);
  const toggleReaction = useChatStore((state) => state.toggleReaction);
  const currentUserId = useChatStore((state) => state.user.id);
  const ownMessage = message.senderId === 'me' || message.senderId === currentUserId;
  const [highlight, setHighlight] = useState(false);

  if (message.type === 'system') {
    return <div className="flex justify-center py-2"><span className="rounded-full bg-panel/80 px-3 py-1.5 text-[11px] text-muted shadow-sm">{message.content}</span></div>;
  }

  const copyMessage = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Message copied');
    } catch {
      toast.error('Could not copy this message');
    }
  };

  const createTask = (): void => {
    onCreateTask(message);
    toast.success('Added to your task board');
  };

  return (
    <div className={cn('group relative flex w-full items-end gap-2 py-1.5', ownMessage ? 'justify-end' : 'justify-start')}>
      {!ownMessage ? <Avatar name={message.senderName} initials={message.senderInitials} size="sm" color="from-sky-200 to-indigo-200" className="mb-1 h-7 w-7 text-[9px]" /> : null}
      <div className={cn('relative max-w-[min(78%,620px)]', ownMessage && 'items-end')}>
        {!ownMessage && message.senderName !== 'Olivia Chen' ? <p className="mb-1 ml-1 text-[10px] font-semibold text-brand-600 dark:text-indigo-300">{message.senderName}</p> : null}
        {message.forwardedFrom ? <p className={cn('mb-1 flex items-center gap-1 text-[10px] italic', ownMessage ? 'justify-end text-white/70' : 'text-slate-400')}><Forward size={11} /> Forwarded</p> : null}
        <div
          onClick={() => { setHighlight(true); window.setTimeout(() => setHighlight(false), 700); }}
          className={cn(
            'relative rounded-[20px] px-3.5 py-2.5 shadow-sm transition-shadow',
            ownMessage ? 'rounded-br-[6px] bg-brand-500 text-white' : 'rounded-bl-[6px] border border-black/[.035] bg-panel text-slate-800 dark:border-white/[.04] dark:text-slate-100',
            highlight && 'ring-2 ring-brand-300/80',
          )}
        >
          {message.replyTo ? (
            <div className={cn('mb-2 rounded-xl border-l-[3px] px-2.5 py-1.5', ownMessage ? 'border-white/70 bg-white/10' : 'border-brand-400 bg-brand-50/80 dark:bg-indigo-950/50')}>
              <p className={cn('text-[10px] font-semibold', ownMessage ? 'text-white/90' : 'text-brand-700 dark:text-indigo-200')}>{message.replyTo.senderName}</p>
              <p className={cn('mt-0.5 line-clamp-2 text-[11px]', ownMessage ? 'text-white/75' : 'text-slate-500 dark:text-slate-400')}>{message.replyTo.content}</p>
            </div>
          ) : null}

          {message.type === 'image' && message.mediaUrl ? (
            <div className="mb-2 overflow-hidden rounded-xl">
              <Image src={message.mediaUrl} alt={message.mediaName ?? 'Shared image'} width={640} height={420} unoptimized className="max-h-[280px] w-full rounded-xl object-cover" sizes="(max-width: 768px) 75vw, 620px" />
            </div>
          ) : null}
          {message.type === 'video' ? (
            <div className="mb-2 grid h-40 w-64 place-items-center rounded-xl bg-slate-900 text-white"><button aria-label="Play video" className="grid h-12 w-12 place-items-center rounded-full bg-white/20"><Play fill="currentColor" size={18} /></button></div>
          ) : null}
          {message.type === 'voice_note' || message.type === 'audio' ? <VoiceNote message={message} outgoing={ownMessage} /> : null}
          {message.type === 'document' ? (
            <a href={message.mediaUrl ?? '#'} onClick={(event) => { if (!message.mediaUrl) event.preventDefault(); }} download={message.mediaName} className={cn('mb-2 flex min-w-[220px] items-center gap-3 rounded-xl p-3', ownMessage ? 'bg-white/10' : 'bg-slate-50 dark:bg-slate-800')}>
              <span className={cn('grid h-10 w-10 place-items-center rounded-xl', ownMessage ? 'bg-white/15' : 'bg-brand-50 text-brand-600 dark:bg-indigo-950/50 dark:text-indigo-300')}><FileText size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{message.mediaName ?? message.content}</span><span className={cn('mt-1 block text-[10px]', ownMessage ? 'text-white/65' : 'text-muted')}>{formatFileSize(message.mediaSize ?? 0)} · Document</span></span>
            </a>
          ) : null}
          {message.type !== 'voice_note' && message.type !== 'audio' && message.type !== 'image' && message.type !== 'document' ? <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.55] md:text-[13px]"><MessageContent text={message.content} /></p> : null}
          {message.type === 'image' && message.content ? <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.55]"><MessageContent text={message.content} /></p> : null}
          <div className={cn('mt-1 flex items-center justify-end gap-1.5 text-[9px]', ownMessage ? 'text-white/65' : 'text-slate-400')}>
            {message.isStarred ? <Star size={10} fill="currentColor" aria-label="Starred" /> : null}
            {message.isEdited ? <span>edited</span> : null}
            <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            {ownMessage ? <DeliveryStatus status={message.status} /> : null}
          </div>
        </div>

        {message.reactions.length > 0 ? (
          <div className={cn('mt-1 flex flex-wrap gap-1', ownMessage ? 'justify-end' : 'justify-start')}>
            {message.reactions.map((reaction) => (
              <button key={reaction.emoji} onClick={() => toggleReaction(message.conversationId, message.id, reaction.emoji)} className="flex h-6 items-center gap-1 rounded-full border border-line bg-panel px-2 text-[11px] shadow-sm hover:border-brand-200" aria-label={`Reacted ${reaction.emoji}`}>
                <span>{reaction.emoji}</span><span className="text-[9px] text-muted">{reaction.userIds.length}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className={cn('absolute top-1/2 z-20 flex -translate-y-1/2 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100', ownMessage ? '-left-10' : '-right-10')}>
          <DropdownMenu.Root onOpenChange={(open) => { if (open) triggerHaptic('medium'); }}>
            <DropdownMenu.Trigger asChild><button aria-label="Message actions" className="grid h-8 w-8 place-items-center rounded-full border border-line bg-panel text-slate-500 shadow-card hover:text-brand-600"><MoreHorizontal size={15} /></button></DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={6} className="z-[80] min-w-48 rounded-2xl border border-line bg-panel p-1.5 shadow-soft">
                <DropdownMenu.Item onSelect={() => onReply(message)} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Reply size={15} /> Reply</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => void copyMessage()} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Copy size={15} /> Copy text</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => toggleStarred(message.conversationId, message.id)} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Star size={15} /> {message.isStarred ? 'Remove star' : 'Star message'}</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={createTask} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><ListTodo size={15} /> Create a task</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => onAiAction(message, 'translate')} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Sparkles size={15} /> Translate</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => onAiAction(message, 'summarize')} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-800"><Sparkles size={15} /> Summarize</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <div className="flex items-center justify-between gap-1 px-2 py-1" role="group" aria-label="Quick reactions">
                  {QUICK_REACTIONS.map((emoji) => <button key={emoji} onClick={() => toggleReaction(message.conversationId, message.id, emoji)} className="grid h-8 w-8 place-items-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`React ${emoji}`}>{emoji}</button>)}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      {ownMessage ? <span className="mb-1 h-7 w-7 shrink-0" aria-hidden="true" /> : null}
    </div>
  );
}
