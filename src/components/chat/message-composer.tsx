'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, type FormEvent, type PointerEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  Camera, FileText, ImagePlus, MapPin, Mic, Plus, SendHorizontal, Smile,
  Sparkles, UserRound, X, Clock3, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatFileSize } from '@/lib/utils/format-file-size';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { compressImage } from '@/lib/storage/compress';
import { createImageThumbnail } from '@/lib/storage/thumbnail';
import { cacheThumbnail } from '@/lib/offline/db';
import { openNativeCamera, openNativeGallery } from '@/lib/median/camera';
import { getCurrentLocation } from '@/lib/median/location';
import type { ChatMessage } from '@/lib/types/message';

const EMOJIS = ['😀', '😂', '🥹', '😍', '🥰', '😊', '🙌', '👏', '✨', '🔥', '💛', '❤️', '👍', '🙏', '🎉', '🚀', '☀️', '💬', '💡', '🥳'];

export interface MessageComposerProps {
  onSend: (content: string, file?: File, voiceDuration?: number) => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onAskAI: () => void;
  disabled?: boolean;
}

/** Mobile-first composer with growing text, replies, attachments, emoji and hold-to-record voice notes. */
export function MessageComposer({ onSend, replyTo, onCancelReply, onAskAI, disabled = false }: MessageComposerProps): JSX.Element {
  const [value, setValue] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const pointerHeldRef = useRef(false);
  const pointerStartRef = useRef(0);
  const stopPendingRef = useRef(false);
  const recordingReadyRef = useRef(false);
  const { isRecording, elapsedSeconds, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const resizeTextarea = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const submit = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const content = value.trim();
    if ((!content && !selectedFile) || disabled || processingFile) return;
    if (selectedFile) {
      let preparedFile = selectedFile;
      if (selectedFile.type.startsWith('image/')) {
        setProcessingFile(true);
        try {
          preparedFile = await compressImage(selectedFile);
          const thumbnail = await createImageThumbnail(preparedFile);
          if (thumbnail) await cacheThumbnail(`local-${Date.now()}-${preparedFile.name}`, thumbnail);
        } catch {
          toast.error('That file could not be prepared. The original will be sent.');
        } finally {
          setProcessingFile(false);
        }
      }
      onSend(content, preparedFile);
      setSelectedFile(null);
    } else {
      onSend(content);
    }
    setValue('');
    setShowEmoji(false);
    setShowAttachments(false);
    if (inputRef.current) inputRef.current.style.height = '44px';
  }, [disabled, onSend, processingFile, selectedFile, value]);

  const acceptFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Files must be 100 MB or smaller.');
      return;
    }
    setSelectedFile(file);
    setShowAttachments(false);
    setShowEmoji(false);
  }, []);

  const pickFromGallery = (): void => {
    if (typeof window === 'undefined') return;
    openNativeGallery((files) => {
      const first = files[0];
      if (!first) return;
      void fetch(first.url).then(async (response) => {
        if (!response.ok) throw new Error('Could not read selected media');
        const blob = await response.blob();
        acceptFile(new File([blob], `shared-media-${Date.now()}`, { type: first.mimeType || blob.type || 'application/octet-stream' }));
      }).catch(() => fileInputRef.current?.click());
    });
  };

  const pickFromCamera = (): void => {
    openNativeCamera((imageUrl) => {
      void fetch(imageUrl).then(async (response) => {
        if (!response.ok) throw new Error('Could not read camera image');
        const blob = await response.blob();
        acceptFile(new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
      }).catch(() => fileInputRef.current?.click());
    });
  };

  const finishRecording = useCallback(async () => {
    if (stopPendingRef.current) return;
    stopPendingRef.current = true;
    recordingReadyRef.current = false;
    const recording = await stopRecording();
    if (recording) onSend('', recording.file, recording.durationSeconds);
    stopPendingRef.current = false;
  }, [onSend, stopRecording]);

  const handleMicDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (disabled || value.trim() || selectedFile) return;
    event.preventDefault();
    pointerHeldRef.current = true;
    pointerStartRef.current = event.clientX;
    stopPendingRef.current = false;
    void startRecording().then(() => {
      recordingReadyRef.current = true;
      if (!pointerHeldRef.current) void finishRecording();
    }).catch((error: unknown) => {
      recordingReadyRef.current = false;
      pointerHeldRef.current = false;
      const message = error instanceof Error ? error.message : 'Microphone access was denied.';
      toast.error(message);
    });
  };

  const handleMicUp = (): void => {
    pointerHeldRef.current = false;
    if (recordingReadyRef.current || isRecording) void finishRecording();
  };

  const handleMicMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (pointerHeldRef.current && event.clientX - pointerStartRef.current < -72) {
      pointerHeldRef.current = false;
      recordingReadyRef.current = false;
      cancelRecording();
      toast('Recording cancelled');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const shareLocation = async (): Promise<void> => {
    try {
      const { latitude, longitude } = await getCurrentLocation();
      setValue(`📍 My location: https://maps.google.com/?q=${latitude.toFixed(5)},${longitude.toFixed(5)}`);
      setShowAttachments(false);
      inputRef.current?.focus();
    } catch {
      toast.error('Allow location access to share where you are.');
    }
  };

  const createPoll = (): void => {
    const question = window.prompt('What would you like to ask?');
    if (!question?.trim()) return;
    setValue(`📊 Poll: ${question.trim()}\n• Yes\n• Not yet`);
    setShowAttachments(false);
    inputRef.current?.focus();
  };

  const recordingLabel = `${Math.floor(elapsedSeconds / 60)}:${`${elapsedSeconds % 60}`.padStart(2, '0')}`;

  return (
    <div className="relative shrink-0 border-t border-line bg-panel px-3 pb-[max(10px,var(--safe-bottom))] pt-3 md:px-6 md:pb-4">
      {showAttachments ? (
        <div className="absolute bottom-[calc(100%-2px)] left-3 z-30 mb-2 w-[min(340px,calc(100vw-24px))] rounded-3xl border border-line bg-panel p-3 shadow-soft md:left-6">
          <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold">Share something</p><button onClick={() => setShowAttachments(false)} aria-label="Close attachments" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={15} /></button></div>
          <div className="grid grid-cols-3 gap-2">
            <AttachmentOption icon={<ImagePlus size={18} />} label="Photos" tone="violet" onClick={pickFromGallery} />
            <AttachmentOption icon={<Camera size={18} />} label="Camera" tone="rose" onClick={pickFromCamera} />
            <AttachmentOption icon={<FileText size={18} />} label="Document" tone="blue" onClick={() => documentInputRef.current?.click()} />
            <AttachmentOption icon={<MapPin size={18} />} label="Location" tone="green" onClick={shareLocation} />
            <AttachmentOption icon={<UserRound size={18} />} label="Contact" tone="amber" onClick={() => { setValue('Alex Morgan · @alexmorgan'); setShowAttachments(false); inputRef.current?.focus(); }} />
            <AttachmentOption icon={<BarChart3 size={18} />} label="Poll" tone="indigo" onClick={createPoll} />
          </div>
        </div>
      ) : null}

      {showEmoji ? (
        <div className="absolute bottom-[calc(100%-2px)] left-3 z-30 mb-2 w-[min(300px,calc(100vw-24px))] rounded-3xl border border-line bg-panel p-3 shadow-soft md:left-6">
          <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold">Quick reactions</p><button onClick={() => setShowEmoji(false)} aria-label="Close emoji picker" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={15} /></button></div>
          <div className="grid grid-cols-5 gap-1">{EMOJIS.map((emoji) => <button key={emoji} onClick={() => { setValue((current) => `${current}${emoji}`); inputRef.current?.focus(); }} className="grid h-10 place-items-center rounded-xl text-xl hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Insert ${emoji}`}>{emoji}</button>)}</div>
        </div>
      ) : null}

      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border-l-[3px] border-brand-500 bg-brand-50/70 px-3 py-2 dark:bg-indigo-950/40">
          <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-brand-700 dark:text-indigo-200">Replying to {replyTo.senderName}</p><p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{replyTo.content || replyTo.mediaName || 'Attachment'}</p></div>
          <button onClick={onCancelReply} aria-label="Cancel reply" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/80"><X size={15} /></button>
        </div>
      ) : null}

      {selectedFile ? (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-line bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/60 dark:text-indigo-300">{selectedFile.type.startsWith('image/') ? <ImagePlus size={17} /> : <FileText size={17} />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{selectedFile.name}</span><span className="text-[10px] text-muted">{formatFileSize(selectedFile.size)}</span></span>
          <button onClick={() => setSelectedFile(null)} aria-label="Remove attachment" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><X size={15} /></button>
        </div>
      ) : null}

      {isRecording ? (
        <div className="mb-2 flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" role="status">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
          <span className="font-semibold">Recording {recordingLabel}</span>
          <span className="flex-1 text-right text-[10px] text-rose-500">← slide to cancel · release to send</span>
        </div>
      ) : null}

      <form onSubmit={(event) => void submit(event)} className="flex items-end gap-2">
        <button type="button" onClick={() => { setShowAttachments((open) => !open); setShowEmoji(false); }} className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800', showAttachments && 'bg-slate-100 text-brand-600 dark:bg-slate-800')} aria-label="Add attachment"><Plus size={20} /></button>
        <div className="flex min-h-11 min-w-0 flex-1 items-end gap-1 rounded-[22px] border border-line bg-canvas px-3 py-1.5 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(event) => { setValue(event.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Recording voice note…' : 'Write a message'}
            aria-label="Write a message"
            rows={1}
            disabled={disabled || isRecording}
            className="max-h-[120px] min-h-[34px] flex-1 resize-none bg-transparent py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button type="button" onClick={() => { setShowEmoji((open) => !open); setShowAttachments(false); }} className={cn('mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800', showEmoji && 'text-brand-600')} aria-label="Open emoji picker"><Smile size={18} /></button>
        </div>
        {!value.trim() && !selectedFile ? (
          <button
            type="button"
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerCancel={handleMicUp}
            onPointerMove={handleMicMove}
            aria-label={isRecording ? 'Release to send voice note' : 'Hold to record a voice note'}
            className={cn('grid h-11 w-11 shrink-0 touch-none place-items-center rounded-2xl transition', isRecording ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25' : 'bg-brand-500 text-white shadow-md shadow-brand-500/20 hover:bg-brand-600')}
          ><Mic size={18} /></button>
        ) : (
          <Button type="submit" size="icon" loading={processingFile} disabled={disabled || processingFile} aria-label="Send message" className="h-11 w-11 rounded-2xl shadow-md shadow-brand-500/20"><SendHorizontal size={18} /></Button>
        )}
      </form>

      <input ref={fileInputRef} type="file" className="sr-only" accept="image/*,video/*,audio/*" onChange={(event) => acceptFile(event.target.files?.[0])} />
      <input ref={documentInputRef} type="file" className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={(event) => acceptFile(event.target.files?.[0])} />
      <div className="mt-2 hidden items-center justify-between px-1 md:flex">
        <div className="flex items-center gap-3 text-[10px] text-slate-400"><span><kbd className="rounded border border-line px-1 py-0.5 font-mono text-[9px]">↵</kbd> to send</span><span><kbd className="rounded border border-line px-1 py-0.5 font-mono text-[9px]">⇧ ↵</kbd> new line</span></div>
        <div className="flex items-center gap-4">
          <Link href="/scheduled-messages" className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 transition hover:text-brand-600"><Clock3 size={12} /> Schedule</Link>
          <button type="button" onClick={onAskAI} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-brand-600 transition hover:text-brand-700 dark:text-indigo-300"><Sparkles size={12} /> Ask Nexa AI</button>
        </div>
      </div>
    </div>
  );
}

function AttachmentOption({ icon, label, tone, onClick }: { icon: ReactNode; label: string; tone: 'violet' | 'rose' | 'blue' | 'green' | 'amber' | 'indigo'; onClick: () => void }): JSX.Element {
  const colors = {
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
    blue: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300',
  };
  return (
    <button type="button" onClick={onClick} className="flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
      <span className={cn('grid h-9 w-9 place-items-center rounded-xl', colors[tone])}>{icon}</span>{label}
    </button>
  );
}
