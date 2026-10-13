'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { demoConversations, demoMessages, demoTasks, demoUser, type TaskItem } from '@/lib/demo-data';
import { getPersistStorage } from '@/lib/utils/persist-storage';
import type { ChatFolder, ConversationSummary, FolderId } from '@/lib/types/conversation';
import type { ChatMessage, MessageStatus } from '@/lib/types/message';
import type { UserProfile } from '@/lib/types/user';

export interface ChatState {
  user: UserProfile;
  conversations: ConversationSummary[];
  messagesByConversation: Record<string, ChatMessage[]>;
  tasks: TaskItem[];
  activeFolder: FolderId;
  searchQuery: string;
  folders: ChatFolder[];
  backendMode: boolean;
  workspaceReady: boolean;
  beginRemoteWorkspace: (user: UserProfile) => void;
  setRemoteWorkspace: (data: { user: UserProfile; conversations: ConversationSummary[]; messagesByConversation: Record<string, ChatMessage[]>; tasks: TaskItem[] }) => void;
  resetDemoWorkspace: () => void;
  upsertRemoteMessage: (message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  updateConversationSummary: (conversationId: string, updates: Partial<ConversationSummary>) => void;
  addMessage: (conversationId: string, content: string, replyTo?: ChatMessage, file?: File, voiceDuration?: number) => ChatMessage;
  setMessageStatus: (conversationId: string, messageId: string, status: MessageStatus) => void;
  markConversationRead: (conversationId: string) => void;
  markConversationUnread: (conversationId: string) => void;
  togglePinned: (conversationId: string) => void;
  toggleMuted: (conversationId: string) => void;
  toggleBlocked: (conversationId: string) => void;
  archiveConversation: (conversationId: string) => void;
  restoreConversation: (conversationId: string) => void;
  toggleStarred: (conversationId: string, messageId: string) => void;
  toggleReaction: (conversationId: string, messageId: string, emoji: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setActiveFolder: (folderId: FolderId) => void;
  setSearchQuery: (query: string) => void;
  addTask: (task: Omit<TaskItem, 'id'>) => TaskItem;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  createConversation: (title: string, type?: ConversationSummary['type']) => string;
}

const folderDefinitions: ChatFolder[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'community', label: 'Community' },
  { id: 'ai_tools', label: 'AI tools' },
];

const cloneSeed = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Shared local-first workspace state. Demo actions remain fully usable without a backend; once
 * Supabase is configured, route handlers persist requests against the protected database.
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      user: demoUser,
      conversations: cloneSeed(demoConversations),
      messagesByConversation: cloneSeed(demoMessages),
      tasks: cloneSeed(demoTasks),
      activeFolder: 'all',
      searchQuery: '',
      folders: folderDefinitions,
      backendMode: false,
      workspaceReady: true,

      beginRemoteWorkspace: (user) => set({
        user,
        backendMode: true,
        workspaceReady: false,
        conversations: [],
        messagesByConversation: {},
        tasks: [],
      }),
      setRemoteWorkspace: ({ user, conversations, messagesByConversation, tasks }) => set({
        user,
        conversations,
        messagesByConversation,
        tasks,
        backendMode: true,
        workspaceReady: true,
      }),
      resetDemoWorkspace: () => set({
        user: demoUser,
        conversations: cloneSeed(demoConversations),
        messagesByConversation: cloneSeed(demoMessages),
        tasks: cloneSeed(demoTasks),
        backendMode: false,
        workspaceReady: true,
      }),
      upsertRemoteMessage: (message) => set((state) => {
        const current = state.messagesByConversation[message.conversationId] ?? [];
        const found = current.some((item) => item.id === message.id);
        const next = found
          ? current.map((item) => item.id === message.id ? message : item)
          : [...current, message].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        return {
          messagesByConversation: { ...state.messagesByConversation, [message.conversationId]: next },
          conversations: state.conversations.map((conversation) => conversation.id === message.conversationId
            ? {
              ...conversation,
              lastMessage: message.content || message.mediaName || 'Attachment',
              lastMessageAt: message.createdAt,
              unreadCount: message.senderId === state.user.id || found ? conversation.unreadCount : conversation.unreadCount + 1,
            }
            : conversation),
        };
      }),
      updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((message) =>
            message.id === messageId ? { ...message, ...updates } : message),
        },
      })),
      updateConversationSummary: (conversationId, updates) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, ...updates }
          : conversation),
      })),

      addMessage: (conversationId, content, replyTo, file, voiceDuration) => {
        const conversation = get().conversations.find((item) => item.id === conversationId);
        const now = new Date().toISOString();
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          conversationId,
          senderId: get().user.id,
          senderName: get().user.displayName,
          senderInitials: get().user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
          type: file ? (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'voice_note' : 'document') : 'text',
          content: file ? file.name : content,
          createdAt: now,
          status: 'sending',
          isEdited: false,
          isStarred: false,
          isDeleted: false,
          reactions: [],
          mediaUrl: file ? URL.createObjectURL(file) : undefined,
          mediaName: file?.name,
          mediaSize: file?.size,
          metadata: voiceDuration ? { duration: voiceDuration } : undefined,
          replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content } : undefined,
        };
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: [...(state.messagesByConversation[conversationId] ?? []), message],
          },
          conversations: state.conversations.map((item) => item.id === conversationId
            ? { ...item, lastMessage: file ? `📎 ${file.name}` : content, lastMessageAt: now, unreadCount: 0 }
            : item),
        }));

        const isOnline = typeof navigator === 'undefined' || navigator.onLine;
        const isRemoteConversation = get().backendMode && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId);
        if (conversation && isOnline && !get().backendMode) {
          // Keep the optimistic indicator visible briefly before confirming the local demo send.
          window.setTimeout(() => get().setMessageStatus(conversationId, message.id, 'read'), 650);
        } else if (!isOnline && isRemoteConversation) {
          void import('@/lib/offline/db').then(({ offlineDatabase }) => offlineDatabase?.outbox.put({
            id: message.id,
            userId: get().user.id,
            conversationId,
            content,
            type: message.type,
            createdAt: now,
            replyToId: replyTo?.id,
            mediaBlob: file,
            mediaName: file?.name,
            mediaType: file?.type,
            attempts: 0,
          })).catch((error: unknown) => console.warn('[NexaChat offline queue]', error));
        }
        return message;
      },

      setMessageStatus: (conversationId, messageId, status) => set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((message) =>
            message.id === messageId ? { ...message, status } : message),
        },
      })),

      markConversationRead: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation),
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((message) =>
            message.senderId === state.user.id ? message : { ...message, status: 'read' }),
        },
      })),

      markConversationUnread: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, unreadCount: Math.max(1, conversation.unreadCount) }
          : conversation),
      })),

      togglePinned: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, isPinned: !conversation.isPinned }
          : conversation),
      })),

      toggleMuted: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, isMuted: !conversation.isMuted }
          : conversation),
      })),

      toggleBlocked: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, isBlocked: !conversation.isBlocked }
          : conversation),
      })),

      archiveConversation: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, isArchived: true }
          : conversation),
      })),

      restoreConversation: (conversationId) => set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, isArchived: false }
          : conversation),
      })),

      toggleStarred: (conversationId, messageId) => set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((message) =>
            message.id === messageId ? { ...message, isStarred: !message.isStarred } : message),
        },
      })),

      toggleReaction: (conversationId, messageId, emoji) => set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((message) => {
            if (message.id !== messageId) return message;
            const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
            if (!existing) return { ...message, reactions: [...message.reactions, { emoji, userIds: ['me'] }] };
            const hasOwnReaction = existing.userIds.includes('me');
            const userIds = hasOwnReaction
              ? existing.userIds.filter((userId) => userId !== 'me')
              : [...existing.userIds, 'me'];
            const reactions = userIds.length
              ? message.reactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, userIds } : reaction)
              : message.reactions.filter((reaction) => reaction.emoji !== emoji);
            return { ...message, reactions };
          }),
        },
      })),

      updateProfile: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
      setActiveFolder: (activeFolder) => set({ activeFolder }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      addTask: (task) => {
        const createdTask = { ...task, id: `task-${crypto.randomUUID()}` };
        set((state) => ({ tasks: [createdTask, ...state.tasks] }));
        return createdTask;
      },
      updateTask: (taskId, updates) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === taskId ? { ...task, ...updates } : task),
      })),

      createConversation: (title, type = 'personal') => {
        const id = `chat-${crypto.randomUUID()}`;
        const initials = title.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
        set((state) => ({
          conversations: [{
            id, type, title, avatarColor: 'from-indigo-300 to-sky-200', initials, lastMessage: 'Say hello 👋',
            lastMessageAt: new Date().toISOString(), unreadCount: 0, isOnline: false, isMuted: false,
            isPinned: false, isArchived: false, isTyping: false, members: [], tags: [type === 'group' ? 'work' : 'personal'],
          }, ...state.conversations],
          messagesByConversation: { ...state.messagesByConversation, [id]: [] },
        }));
        return id;
      },
    }),
    {
      name: 'nexachat-workspace-v1',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(getPersistStorage),
      // Keep authenticated server data out of the shared localStorage demo cache.
      partialize: (state) => state.backendMode ? ({
        user: demoUser,
        conversations: cloneSeed(demoConversations),
        messagesByConversation: cloneSeed(demoMessages),
        tasks: cloneSeed(demoTasks),
        activeFolder: state.activeFolder,
        folders: folderDefinitions,
      }) : ({
        user: state.user,
        conversations: state.conversations,
        messagesByConversation: state.messagesByConversation,
        tasks: state.tasks,
        activeFolder: state.activeFolder,
        folders: state.folders,
      }),
    },
  ),
);
