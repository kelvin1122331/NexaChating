export type ConversationType = 'personal' | 'group' | 'channel' | 'self';

export interface ConversationMemberSummary {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  role: 'owner' | 'admin' | 'member' | 'readonly';
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  avatarColor: string;
  initials: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isOnline: boolean;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isBlocked?: boolean;
  isTyping: boolean;
  members: ConversationMemberSummary[];
  tags: string[];
}

export type FolderId = 'all' | 'unread' | 'personal' | 'work' | 'community' | 'ai_tools';

export interface ChatFolder {
  id: FolderId;
  label: string;
  icon?: string;
  unreadCount?: number;
}
