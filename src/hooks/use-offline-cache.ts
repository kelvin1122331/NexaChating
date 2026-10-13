'use client';

import { useEffect } from 'react';
import { offlineDatabase, cacheConversationMessages } from '@/lib/offline/db';
import { flushOfflineMessageQueue } from '@/lib/offline/sync';
import { useChatStore } from '@/stores/chat-store';

/** Keeps a bounded IndexedDB snapshot and flushes the outgoing queue after connectivity returns. */
export function useOfflineCache(): void {
  const user = useChatStore((state) => state.user);
  const conversations = useChatStore((state) => state.conversations);
  const messages = useChatStore((state) => state.messagesByConversation);
  const tasks = useChatStore((state) => state.tasks);

  useEffect(() => {
    const database = offlineDatabase;
    if (!database) return;
    let active = true;
    void (async () => {
      try {
        const cachedProfile = await database.profile.get('current-user');
        if (cachedProfile && cachedProfile.id !== user.id) {
          await database.transaction('rw', [database.profile, database.conversations, database.messages, database.tasks, database.thumbnails, database.outbox], async () => {
            await Promise.all([
              database.profile.clear(),
              database.conversations.clear(),
              database.messages.clear(),
              database.tasks.clear(),
              database.thumbnails.clear(),
              database.outbox.clear(),
            ]);
          });
        }
        await database.profile.put({ ...user, cacheKey: 'current-user', cachedAt: Date.now() });
        const recentConversations = conversations.filter((conversation) => !conversation.isArchived).slice(0, 100);
        await database.conversations.bulkPut(recentConversations.map((conversation) => ({ ...conversation, cachedAt: Date.now() })));
        await database.tasks.bulkPut(tasks.slice(0, 100).map((task) => ({ ...task, cachedAt: Date.now() })));
        await Promise.all(Object.entries(messages).map(([conversationId, history]) => cacheConversationMessages(conversationId, history)));
      } catch (error) {
        if (active) console.warn('[NexaChat offline cache]', error);
      }
    })();
    return () => { active = false; };
  }, [conversations, messages, tasks, user]);

  useEffect(() => {
    const handleOnline = (): void => { void flushOfflineMessageQueue(); };
    const handleWorkerMessage = (event: MessageEvent<unknown>): void => {
      if (event.data && typeof event.data === 'object' && 'type' in event.data && event.data.type === 'FLUSH_MESSAGE_QUEUE') void flushOfflineMessageQueue();
    };
    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    if (navigator.onLine) void flushOfflineMessageQueue();
    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
    };
  }, []);
}
