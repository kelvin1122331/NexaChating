'use client';

import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { offlineDatabase } from '@/lib/offline/db';
import type { ConversationSummary, ConversationMemberSummary } from '@/lib/types/conversation';
import type { ChatMessage, MessageReaction, MessageType } from '@/lib/types/message';
import type { UserProfile } from '@/lib/types/user';
import type { TaskItem } from '@/lib/demo-data';
import type { Database, Json } from '@/lib/types/database';
import { useChatStore } from '@/stores/chat-store';

const avatarColors = [
  'from-indigo-300 to-violet-200', 'from-rose-300 to-orange-200', 'from-sky-300 to-cyan-200',
  'from-emerald-300 to-lime-200', 'from-amber-300 to-yellow-200', 'from-violet-300 to-indigo-200',
];

type ProfileRow = Pick<Database['public']['Tables']['users']['Row'], 'id' | 'display_name' | 'username' | 'avatar_url' | 'bio' | 'status_text' | 'status_emoji' | 'is_online' | 'last_seen_at' | 'is_verified' | 'account_type' | 'locale' | 'timezone' | 'theme'>;
type MessageRow = Database['public']['Tables']['messages']['Row'];
type ConversationRow = Database['public']['Tables']['conversations']['Row'];
type MembershipRow = Database['public']['Tables']['conversation_members']['Row'];
type MediaRow = Database['public']['Tables']['media']['Row'];

function withoutCachedAt<T extends { cachedAt: number }>(record: T): Omit<T, 'cachedAt'> {
  const { cachedAt, ...withoutTimestamp } = record;
  void cachedAt;
  return withoutTimestamp;
}

function initials(value: string): string {
  return value.trim().split(/\s+/).map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'N';
}

function asRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseReactions(value: Json): MessageReaction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, Json>;
    const emoji = record.emoji;
    const userIds = record.userIds;
    if (typeof emoji !== 'string' || !Array.isArray(userIds)) return [];
    return [{ emoji, userIds: userIds.filter((id): id is string => typeof id === 'string') }];
  });
}

function simpleMetadata(value: Json): Record<string, string | number | boolean> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string | number | boolean] =>
    typeof entry[1] === 'string' || typeof entry[1] === 'number' || typeof entry[1] === 'boolean'));
}

function toUserProfile(authUser: User, row?: ProfileRow): UserProfile {
  const displayName = row?.display_name || (typeof authUser.user_metadata.display_name === 'string' ? authUser.user_metadata.display_name : '') || authUser.email?.split('@')[0] || 'Nexa user';
  return {
    id: authUser.id,
    displayName,
    username: row?.username || (typeof authUser.user_metadata.username === 'string' ? authUser.user_metadata.username : `user_${authUser.id.slice(0, 8)}`),
    email: authUser.email,
    phone: authUser.phone,
    avatarUrl: row?.avatar_url ?? null,
    bio: row?.bio ?? '',
    statusText: row?.status_text ?? '',
    isOnline: row?.is_online ?? true,
    lastSeenAt: row?.last_seen_at,
    isVerified: row?.is_verified ?? false,
    accountType: row?.account_type ?? 'personal',
    locale: row?.locale ?? 'en',
    theme: row?.theme === 'light' || row?.theme === 'dark' ? row.theme : 'system',
  };
}

function toChatMessage(
  row: MessageRow,
  profiles: Map<string, ProfileRow>,
  currentUserId: string,
  media?: MediaRow,
  signedUrls: Map<string, string> = new Map(),
): ChatMessage {
  const profile = profiles.get(row.sender_id);
  const senderName = profile?.display_name ?? 'Nexa member';
  const metadata = asRecord(row.metadata);
  const supportedTypes = new Set<MessageType>(['text', 'image', 'video', 'audio', 'voice_note', 'document', 'system', 'ai_response', 'task']);
  const type = supportedTypes.has(row.type as MessageType) ? row.type as MessageType : 'text';
  const mediaUrl = media ? signedUrls.get(media.file_path) : undefined;
  const content = row.is_deleted ? 'This message was deleted.' : row.content ?? media?.file_name ?? '';
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_id === currentUserId ? 'You' : senderName,
    senderInitials: initials(senderName),
    type,
    content,
    createdAt: row.created_at,
    status: row.status,
    isEdited: row.is_edited,
    isStarred: row.is_starred,
    isDeleted: row.is_deleted,
    reactions: parseReactions(row.reactions),
    mediaUrl,
    mediaName: media?.file_name ?? (typeof metadata.fileName === 'string' ? metadata.fileName : undefined),
    mediaSize: media?.file_size,
    metadata: simpleMetadata(row.metadata),
  };
}

function toConversationSummary(
  row: ConversationRow,
  membership: MembershipRow,
  members: MembershipRow[],
  profiles: Map<string, ProfileRow>,
  messages: ChatMessage[],
  currentUserId: string,
): ConversationSummary {
  const otherMembers = members.filter((member) => member.user_id !== currentUserId && member.left_at === null);
  const memberSummaries: ConversationMemberSummary[] = otherMembers.map((member) => {
    const profile = profiles.get(member.user_id);
    const displayName = profile?.display_name ?? 'Nexa member';
    return {
      id: member.user_id,
      displayName,
      username: profile?.username ?? `user_${member.user_id.slice(0, 8)}`,
      avatarUrl: profile?.avatar_url ?? null,
      isOnline: profile?.is_online ?? false,
      role: member.role,
    };
  });
  const directProfile = otherMembers[0] ? profiles.get(otherMembers[0].user_id) : undefined;
  const title = row.type === 'self' ? 'Saved messages' : row.title?.trim() || directProfile?.display_name || 'Conversation';
  const lastMessage = messages.at(-1);
  const lastMessagePreview = lastMessage
    ? `${row.type !== 'personal' && lastMessage.senderId !== currentUserId ? `${lastMessage.senderName}: ` : ''}${lastMessage.content || lastMessage.mediaName || 'Attachment'}`
    : 'Start a conversation';
  const isMuted = membership.is_muted && (!membership.mute_until || Date.parse(membership.mute_until) > Date.now());
  const paletteIndex = [...row.id].reduce((total, character) => total + character.charCodeAt(0), 0) % avatarColors.length;
  const memberCount = members.filter((member) => member.left_at === null).length;
  return {
    id: row.id,
    type: row.type,
    title,
    subtitle: row.type === 'personal' ? directProfile?.status_text || (directProfile?.is_online ? 'online now' : 'last seen recently')
      : row.type === 'self' ? 'Private notes to yourself' : `${memberCount} members`,
    avatarUrl: row.type === 'personal' ? directProfile?.avatar_url ?? null : row.avatar_url,
    avatarColor: avatarColors[paletteIndex] ?? avatarColors[0]!,
    initials: initials(title),
    lastMessage: lastMessagePreview,
    lastMessageAt: lastMessage?.createdAt ?? row.updated_at,
    unreadCount: membership.unread_count,
    isOnline: row.type === 'personal' ? directProfile?.is_online ?? false : otherMembers.some((member) => profiles.get(member.user_id)?.is_online),
    isMuted,
    isPinned: membership.is_pinned,
    isArchived: membership.is_archived,
    isTyping: false,
    members: memberSummaries,
    tags: row.type === 'personal' || row.type === 'self' ? [row.type === 'self' ? 'ai_tools' : 'personal'] : [row.type === 'channel' ? 'community' : 'work'],
  };
}

function toTask(row: Database['public']['Tables']['tasks']['Row'], profiles: Map<string, ProfileRow>, currentUserId: string): TaskItem | null {
  if (row.status === 'cancelled') return null;
  const assignee = row.assignee_id ? profiles.get(row.assignee_id)?.display_name : undefined;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    assignee: assignee ?? (row.assignee_id === currentUserId ? 'You' : 'Unassigned'),
    conversationId: row.conversation_id ?? undefined,
  };
}

async function loadWorkspace(authUser: User, active: () => boolean): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const store = useChatStore.getState();
  const { data: memberships, error: membershipError } = await supabase.from('conversation_members')
    .select('*').eq('user_id', authUser.id).is('left_at', null).limit(500);
  if (!active()) return;
  if (membershipError) throw membershipError;
  const memberRows = memberships ?? [];
  const conversationIds = memberRows.map((member) => member.conversation_id);
  if (!conversationIds.length) {
    store.setRemoteWorkspace({
      user: toUserProfile(authUser), conversations: [], messagesByConversation: {}, tasks: [],
    });
    return;
  }

  const [conversationResult, membersResult, messagesResult, tasksResult] = await Promise.all([
    supabase.from('conversations').select('*').in('id', conversationIds).limit(500),
    supabase.from('conversation_members').select('*').in('conversation_id', conversationIds).is('left_at', null).limit(2_000),
    supabase.from('messages').select('*').in('conversation_id', conversationIds).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(1_000),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  if (!active()) return;
  if (conversationResult.error) throw conversationResult.error;
  if (membersResult.error) throw membersResult.error;
  if (messagesResult.error) throw messagesResult.error;
  if (tasksResult.error) throw tasksResult.error;
  const conversationRows = conversationResult.data ?? [];
  const allMembers = membersResult.data ?? [];
  const messageRows = messagesResult.data ?? [];
  const taskRows = tasksResult.data ?? [];
  const messageIds = messageRows.map((message) => message.id);
  const mediaResult = messageIds.length
    ? await supabase.from('media').select('*').in('message_id', messageIds).limit(500)
    : { data: [], error: null };
  if (!active()) return;
  if (mediaResult.error) console.warn('[NexaChat workspace] Media metadata could not be loaded.', mediaResult.error.code);
  const mediaRows = mediaResult.data ?? [];
  const filePaths = mediaRows.flatMap((media) => [media.file_path, media.thumbnail_path].filter((path): path is string => Boolean(path)));
  const signedResult = filePaths.length ? await supabase.storage.from('chat-media').createSignedUrls(filePaths, 3_600) : { data: [], error: null };
  if (!active()) return;
  if (signedResult.error) console.warn('[NexaChat workspace] Media URLs could not be signed.', signedResult.error.message);
  const signedUrls = new Map((signedResult.data ?? []).flatMap((entry) => entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : []));

  const profileIds = [...new Set([
    authUser.id,
    ...allMembers.map((member) => member.user_id),
    ...messageRows.map((message) => message.sender_id),
    ...taskRows.flatMap((task) => [task.creator_id, task.assignee_id].filter((id): id is string => Boolean(id))),
  ])];
  const profileResult = await supabase.from('users')
    .select('id,display_name,username,avatar_url,bio,status_text,status_emoji,is_online,last_seen_at,is_verified,account_type,locale,timezone,theme')
    .in('id', profileIds);
  if (!active()) return;
  if (profileResult.error) console.warn('[NexaChat workspace] Profile details could not be loaded.', profileResult.error.code);
  const profileRows = profileResult.data ?? [];
  const profiles = new Map(profileRows.map((profile) => [profile.id, profile]));
  const user = toUserProfile(authUser, profiles.get(authUser.id));
  const mediaByMessage = new Map(mediaRows.filter((media) => media.message_id).map((media) => [media.message_id!, media]));
  const mappedById = new Map(messageRows.map((row) => [row.id, toChatMessage(row, profiles, authUser.id, mediaByMessage.get(row.id), signedUrls)]));
  const messagesByConversation: Record<string, ChatMessage[]> = {};
  for (const row of messageRows) {
    const message = mappedById.get(row.id);
    if (!message) continue;
    if (row.reply_to_id) {
      const replied = mappedById.get(row.reply_to_id);
      if (replied) message.replyTo = { id: replied.id, senderName: replied.senderName, content: replied.content };
    }
    (messagesByConversation[row.conversation_id] ??= []).push(message);
  }
  for (const messages of Object.values(messagesByConversation)) messages.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  const memberLookup = new Map<string, MembershipRow[]>();
  for (const member of allMembers) {
    const relatedMembers = memberLookup.get(member.conversation_id) ?? [];
    relatedMembers.push(member);
    memberLookup.set(member.conversation_id, relatedMembers);
  }
  const membershipByConversation = new Map(memberRows.map((member) => [member.conversation_id, member]));
  const conversations = conversationRows.flatMap((row) => {
    const membership = membershipByConversation.get(row.id);
    if (!membership) return [];
    return [toConversationSummary(row, membership, memberLookup.get(row.id) ?? [], profiles, messagesByConversation[row.id] ?? [], authUser.id)];
  }).sort((left, right) => Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt));
  const tasks = taskRows.map((task) => toTask(task, profiles, authUser.id)).filter((task): task is TaskItem => Boolean(task));
  store.setRemoteWorkspace({ user, conversations, messagesByConversation, tasks });
}

async function restoreOfflineWorkspace(authUser: User): Promise<boolean> {
  const database = offlineDatabase;
  if (!database) return false;
  const cachedProfile = await database.profile.get('current-user');
  if (!cachedProfile || cachedProfile.id !== authUser.id) return false;
  const [cachedConversations, cachedMessages, cachedTasks] = await Promise.all([
    database.conversations.toArray(), database.messages.toArray(), database.tasks.toArray(),
  ]);
  const messagesByConversation: Record<string, ChatMessage[]> = {};
  for (const record of cachedMessages) {
    const message = withoutCachedAt(record);
    (messagesByConversation[message.conversationId] ??= []).push(message);
  }
  for (const messages of Object.values(messagesByConversation)) messages.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const user: UserProfile = {
    id: cachedProfile.id,
    displayName: cachedProfile.displayName,
    username: cachedProfile.username,
    email: cachedProfile.email,
    phone: cachedProfile.phone,
    avatarUrl: cachedProfile.avatarUrl,
    bio: cachedProfile.bio,
    statusText: cachedProfile.statusText,
    isOnline: false,
    lastSeenAt: cachedProfile.lastSeenAt,
    isVerified: cachedProfile.isVerified,
    accountType: cachedProfile.accountType,
    locale: cachedProfile.locale,
    theme: cachedProfile.theme,
  };
  useChatStore.getState().setRemoteWorkspace({
    user,
    conversations: cachedConversations.map(withoutCachedAt),
    messagesByConversation,
    tasks: cachedTasks.map(withoutCachedAt),
  });
  return true;
}

/** Hydrates an authenticated workspace from Supabase, subscribes to realtime updates, and restores cached data offline. */
export function useRemoteWorkspace(): void {
  const { user: authUser, loading } = useAuth();
  const beginRemoteWorkspace = useChatStore((state) => state.beginRemoteWorkspace);
  const resetDemoWorkspace = useChatStore((state) => state.resetDemoWorkspace);

  useEffect(() => {
    if (loading) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser) {
      resetDemoWorkspace();
      return;
    }
    const userProfile: UserProfile = {
      id: authUser.id,
      displayName: (typeof authUser.user_metadata.display_name === 'string' && authUser.user_metadata.display_name) || authUser.email?.split('@')[0] || 'Nexa user',
      username: (typeof authUser.user_metadata.username === 'string' && authUser.user_metadata.username) || `user_${authUser.id.slice(0, 8)}`,
      email: authUser.email,
      phone: authUser.phone,
      avatarUrl: null,
      bio: '',
      statusText: '',
      isOnline: false,
      isVerified: false,
      accountType: 'personal',
      locale: 'en',
      theme: 'system',
    };
    beginRemoteWorkspace(userProfile);
    let active = true;
    let hasLoaded = false;
    const refresh = async (): Promise<void> => {
      try {
        await loadWorkspace(authUser, () => active);
        hasLoaded = true;
      } catch (error) {
        if (!active) return;
        console.warn('[NexaChat workspace] Supabase data could not be loaded.', error);
        if (!hasLoaded && !navigator.onLine) await restoreOfflineWorkspace(authUser);
      }
    };
    void refresh();
    const channel = supabase.channel(`workspace:${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (!active || !hasLoaded || !payload.new || typeof payload.new !== 'object') return;
        const row = payload.new as MessageRow;
        if (!useChatStore.getState().conversations.some((conversation) => conversation.id === row.conversation_id)) return;
        void (async () => {
          const [profileResponse, mediaResponse] = await Promise.all([
            supabase.from('users').select('id,display_name,username,avatar_url,bio,status_text,status_emoji,is_online,last_seen_at,is_verified,account_type,locale,timezone,theme').eq('id', row.sender_id).maybeSingle(),
            supabase.from('media').select('*').eq('message_id', row.id).maybeSingle(),
          ]);
          const profiles = new Map<string, ProfileRow>();
          if (profileResponse.data) profiles.set(profileResponse.data.id, profileResponse.data);
          const media = mediaResponse.data ?? undefined;
          const paths = media ? [media.file_path, media.thumbnail_path].filter((path): path is string => Boolean(path)) : [];
          const signed = paths.length ? await supabase.storage.from('chat-media').createSignedUrls(paths, 3_600) : { data: [], error: null };
          const signedUrls = new Map((signed.data ?? []).flatMap((entry) => entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : []));
          const message = toChatMessage(row, profiles, authUser.id, media, signedUrls);
          const state = useChatStore.getState();
          const existing = state.messagesByConversation[row.conversation_id]?.find((item) => item.id === row.reply_to_id);
          if (existing) message.replyTo = { id: existing.id, senderName: existing.senderName, content: existing.content };
          state.upsertRemoteMessage(message);
        })().catch((error: unknown) => console.warn('[NexaChat realtime] Message could not be rendered.', error));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media' }, () => { if (active && hasLoaded) void refresh(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${authUser.id}` }, (payload) => {
        if (!payload.new || typeof payload.new !== 'object') return;
        const member = payload.new as MembershipRow;
        useChatStore.getState().updateConversationSummary(member.conversation_id, {
          unreadCount: member.unread_count,
          isMuted: member.is_muted && (!member.mute_until || Date.parse(member.mute_until) > Date.now()),
          isPinned: member.is_pinned,
          isArchived: member.is_archived,
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${authUser.id}` }, () => { if (active) void refresh(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${authUser.id}` }, () => { if (active) void refresh(); })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authUser, beginRemoteWorkspace, loading, resetDemoWorkspace]);
}
