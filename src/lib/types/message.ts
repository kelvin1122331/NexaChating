export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice_note'
  | 'document'
  | 'system'
  | 'ai_response'
  | 'task';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  type: MessageType;
  content: string;
  createdAt: string;
  status: MessageStatus;
  replyTo?: Pick<ChatMessage, 'id' | 'senderName' | 'content'>;
  forwardedFrom?: string;
  isEdited: boolean;
  isStarred: boolean;
  isDeleted: boolean;
  reactions: MessageReaction[];
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  metadata?: Record<string, string | number | boolean>;
}
