'use client';

import Dexie, { type EntityTable } from 'dexie';
import type { ChatMessage } from '@/lib/types/message';
import type { ConversationSummary } from '@/lib/types/conversation';
import type { TaskItem } from '@/lib/demo-data';
import type { UserProfile } from '@/lib/types/user';

export interface CachedProfile extends UserProfile { cacheKey: 'current-user'; cachedAt: number; }
export interface CachedConversation extends ConversationSummary { cachedAt: number; }
export interface CachedMessage extends ChatMessage { cachedAt: number; }
export interface CachedTask extends TaskItem { cachedAt: number; }
export interface QueuedMessage {
  id: string;
  userId: string;
  conversationId: string;
  content: string;
  type: ChatMessage['type'];
  createdAt: string;
  replyToId?: string;
  mediaBlob?: Blob;
  mediaName?: string;
  mediaType?: string;
  attempts: number;
}
export interface CachedThumbnail { id: string; blob: Blob; cachedAt: number; }

class NexaOfflineDatabase extends Dexie {
  profile!: EntityTable<CachedProfile, 'cacheKey'>;
  conversations!: EntityTable<CachedConversation, 'id'>;
  messages!: EntityTable<CachedMessage, 'id'>;
  tasks!: EntityTable<CachedTask, 'id'>;
  thumbnails!: EntityTable<CachedThumbnail, 'id'>;
  outbox!: EntityTable<QueuedMessage, 'id'>;

  constructor() {
    super('nexachat-offline-v1');
    this.version(1).stores({
      profile: 'cacheKey, cachedAt',
      conversations: 'id, lastMessageAt, isArchived',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      tasks: 'id, status, dueDate',
      thumbnails: 'id, cachedAt',
      outbox: 'id, conversationId, createdAt, attempts',
    });
  }
}

/** IndexedDB cache for offline snapshots, image previews and ordered outgoing messages. */
export const offlineDatabase = typeof window === 'undefined' ? null : new NexaOfflineDatabase();

/** Caches a thumbnail while keeping the newest 500 local previews. */
export async function cacheThumbnail(id: string, blob: Blob): Promise<void> {
  if (!offlineDatabase) return;
  await offlineDatabase.thumbnails.put({ id, blob, cachedAt: Date.now() });
  const excess = (await offlineDatabase.thumbnails.orderBy('cachedAt').keys()).filter((key): key is string => typeof key === 'string');
  if (excess.length > 500) await offlineDatabase.thumbnails.bulkDelete(excess.slice(0, excess.length - 500));
}

/** Writes at most the latest 200 messages per conversation to local offline storage. */
export async function cacheConversationMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
  if (!offlineDatabase || !messages.length) return;
  const records = messages.slice(-200).map((message) => ({ ...message, cachedAt: Date.now() }));
  await offlineDatabase.transaction('rw', offlineDatabase.messages, async () => {
    await offlineDatabase.messages.bulkPut(records);
    const stale = await offlineDatabase.messages.where('conversationId').equals(conversationId).sortBy('createdAt');
    if (stale.length > 200) await offlineDatabase.messages.bulkDelete(stale.slice(0, stale.length - 200).map(({ id }) => id));
  });
}
