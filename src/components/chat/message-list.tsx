'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList, type ListChildComponentProps, type VariableSizeList as VariableSizeListType } from 'react-window';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatDayLabel } from '@/lib/utils/format-date';
import { MessageBubble } from '@/components/chat/message-bubble';
import type { ChatMessage } from '@/lib/types/message';

interface MessageListProps {
  messages: ChatMessage[];
  onReply: (message: ChatMessage) => void;
  onCreateTask: (message: ChatMessage) => void;
  onAiAction: (message: ChatMessage, action: 'translate' | 'summarize') => void;
}

type ListData = MessageListProps;

function estimateItemHeight(message: ChatMessage, hasDateDivider: boolean): number {
  const dateHeight = hasDateDivider ? 34 : 0;
  if (message.type === 'image') return 330 + dateHeight;
  if (message.type === 'video') return 225 + dateHeight;
  if (message.type === 'voice_note' || message.type === 'audio') return 92 + dateHeight;
  if (message.type === 'document') return 112 + dateHeight;
  const lineCount = Math.min(9, Math.max(1, Math.ceil(message.content.length / 49)));
  const replyHeight = message.replyTo ? 48 : 0;
  return 42 + lineCount * 19 + replyHeight + dateHeight;
}

function hasDateDivider(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const current = messages[index]?.createdAt;
  const previous = messages[index - 1]?.createdAt;
  return Boolean(current && previous && formatDayLabel(current) !== formatDayLabel(previous));
}

function MessageRow({ index, style, data }: ListChildComponentProps<ListData>): JSX.Element | null {
  const message = data.messages[index];
  if (!message) return null;
  const showDate = hasDateDivider(data.messages, index);
  return (
    <div style={style} className="px-4 md:px-7">
      {showDate ? <div className="flex h-[34px] items-center justify-center"><span className="rounded-full border border-line/70 bg-panel/85 px-3 py-1 text-[10px] font-medium text-slate-400 shadow-sm backdrop-blur-sm">{formatDayLabel(message.createdAt)}</span></div> : null}
      <MessageBubble message={message} onReply={data.onReply} onCreateTask={data.onCreateTask} onAiAction={data.onAiAction} />
    </div>
  );
}

/** Virtualized, date-separated message history; rendering cost stays bounded for large chats. */
export function MessageList({ messages, onReply, onCreateTask, onAiAction }: MessageListProps): JSX.Element {
  const listRef = useRef<VariableSizeListType>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const priorCount = useRef(messages.length);
  const [height, setHeight] = useState(420);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.max(180, Math.floor(entry.contentRect.height)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previousCount = priorCount.current;
    if (messages.length > previousCount && !atBottom) setNewCount((count) => count + messages.length - previousCount);
    if (atBottom && messages.length > 0) listRef.current?.scrollToItem(messages.length - 1, 'end');
    priorCount.current = messages.length;
    listRef.current?.resetAfterIndex(0, true);
  }, [atBottom, messages]);

  const itemSize = useCallback((index: number) => {
    const message = messages[index];
    return message ? estimateItemHeight(message, hasDateDivider(messages, index)) : 70;
  }, [messages]);

  const estimatedTotal = useMemo(() => messages.reduce((total, message, index) => total + estimateItemHeight(message, hasDateDivider(messages, index)), 0), [messages]);
  const itemData = useMemo<ListData>(() => ({ messages, onReply, onCreateTask, onAiAction }), [messages, onAiAction, onCreateTask, onReply]);

  if (!messages.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-white text-3xl shadow-card dark:bg-slate-800">👋</span>
        <p className="mt-5 text-base font-semibold">A fresh conversation</p>
        <p className="mt-1 max-w-xs text-sm leading-6 text-muted">Say hello and start something good.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1">
      <VariableSizeList
        ref={listRef}
        height={height}
        width="100%"
        itemCount={messages.length}
        itemSize={itemSize}
        itemData={itemData}
        itemKey={(index, data: ListData) => data.messages[index]?.id ?? index}
        onItemsRendered={({ visibleStopIndex }) => {
          const isNearEnd = visibleStopIndex >= messages.length - 2;
          setAtBottom(isNearEnd);
          if (isNearEnd) setNewCount(0);
        }}
        overscanCount={6}
        className="scrollbar-none"
        estimatedItemSize={80}
      >
        {MessageRow}
      </VariableSizeList>
      {!atBottom && estimatedTotal > height ? (
        <button onClick={() => { listRef.current?.scrollToItem(messages.length - 1, 'end'); setAtBottom(true); setNewCount(0); }} className="absolute bottom-4 right-5 z-10 grid h-11 min-w-11 place-items-center rounded-full border border-line bg-panel px-3 text-slate-600 shadow-soft transition hover:-translate-y-0.5 hover:text-brand-600 dark:text-slate-300" aria-label="Scroll to latest messages">
          <ArrowDown size={17} />
          {newCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">{newCount}</span> : null}
        </button>
      ) : null}
      <span className={cn('sr-only')} aria-live="polite">{messages.length} messages</span>
    </div>
  );
}
