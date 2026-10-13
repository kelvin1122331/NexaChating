'use client';

import { offlineDatabase } from '@/lib/offline/db';
import { useChatStore } from '@/stores/chat-store';

let flushInProgress = false;

/** Sends queued messages in order with their original UUIDs, retaining retryable failures for reconnect. */
export async function flushOfflineMessageQueue(): Promise<void> {
  const database = offlineDatabase;
  if (!database || !navigator.onLine || flushInProgress) return;
  flushInProgress = true;
  try {
    const queuedMessages = await database.outbox.orderBy('createdAt').toArray();
    for (const queued of queuedMessages) {
      if (queued.userId !== useChatStore.getState().user.id) {
        await database.outbox.delete(queued.id);
        continue;
      }
      let response: Response;
      try {
        if (queued.mediaBlob) {
          const form = new FormData();
          form.set('conversationId', queued.conversationId);
          form.set('content', queued.content);
          form.set('clientMessageId', queued.id);
          if (queued.replyToId) form.set('replyToId', queued.replyToId);
          const fileName = queued.mediaName || `${queued.id}.bin`;
          const file = new File([queued.mediaBlob], fileName, { type: queued.mediaType || queued.mediaBlob.type });
          form.set('file', file, file.name);
          response = await fetch('/api/messages/send', { method: 'POST', body: form });
        } else {
          response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: queued.conversationId,
              content: queued.content,
              clientMessageId: queued.id,
              replyToId: queued.replyToId,
            }),
          });
        }
      } catch {
        break;
      }

      if (!response.ok) {
        await database.outbox.update(queued.id, { attempts: queued.attempts + 1 });
        if (response.status === 401 || response.status === 408 || response.status === 429 || response.status >= 500) break;
        await database.outbox.delete(queued.id);
        useChatStore.getState().setMessageStatus(queued.conversationId, queued.id, 'failed');
        continue;
      }
      await database.outbox.delete(queued.id);
      useChatStore.getState().setMessageStatus(queued.conversationId, queued.id, 'sent');
    }
  } finally {
    flushInProgress = false;
  }
}
