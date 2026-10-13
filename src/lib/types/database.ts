export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship<
  ForeignKeyName extends string,
  Columns extends string[],
  ReferencedRelation extends string,
  ReferencedColumns extends string[],
  IsOneToOne extends boolean = false,
> = {
  foreignKeyName: ForeignKeyName;
  columns: Columns;
  isOneToOne: IsOneToOne;
  referencedRelation: ReferencedRelation;
  referencedColumns: ReferencedColumns;
};

type Table<
  Row,
  RequiredInsertKeys extends keyof Row = never,
  Relationships extends Relationship<string, string[], string, string[], boolean>[] = [],
> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredInsertKeys>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

/** Supabase schema types kept in sync with the ordered SQL migrations. */
export interface Database {
  public: {
    Tables: {
      users: Table<
        {
          id: string;
          phone: string | null;
          email: string | null;
          display_name: string;
          username: string;
          avatar_url: string | null;
          bio: string;
          status_text: string;
          status_emoji: string;
          is_online: boolean;
          last_seen_at: string;
          is_verified: boolean;
          is_business: boolean;
          account_type: Database['public']['Enums']['account_type'];
          locale: string;
          timezone: string;
          theme: 'system' | 'light' | 'dark';
          privacy_last_seen: 'everyone' | 'contacts' | 'nobody';
          privacy_avatar: 'everyone' | 'contacts' | 'nobody';
          privacy_read_receipt: boolean;
          privacy_screenshot: boolean;
          push_token: string | null;
          onesignal_id: string | null;
          encryption_pub: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        'id' | 'display_name' | 'username'
      >;
      contacts: Table<
        {
          id: string;
          user_id: string;
          contact_user_id: string;
          nickname: string | null;
          is_favorite: boolean;
          is_blocked: boolean;
          blocked_at: string | null;
          created_at: string;
        },
        'user_id' | 'contact_user_id',
        [
          Relationship<'contacts_user_id_fkey', ['user_id'], 'users', ['id']>,
          Relationship<'contacts_contact_user_id_fkey', ['contact_user_id'], 'users', ['id']>,
        ]
      >;
      conversations: Table<
        {
          id: string;
          type: Database['public']['Enums']['conversation_type'];
          title: string | null;
          description: string | null;
          avatar_url: string | null;
          invite_link: string | null;
          is_archived: boolean;
          is_pinned: boolean;
          is_muted: boolean;
          mute_until: string | null;
          max_members: number;
          only_admins_msg: boolean;
          disappearing: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        never,
        [Relationship<'conversations_created_by_fkey', ['created_by'], 'users', ['id']>]
      >;
      chat_folders: Table<
        {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          color: string;
          type: Database['public']['Enums']['folder_type'];
          filter_rules: Json;
          sort_order: number;
          created_at: string;
        },
        'user_id' | 'name',
        [Relationship<'chat_folders_user_id_fkey', ['user_id'], 'users', ['id']>]
      >;
      conversation_members: Table<
        {
          id: string;
          conversation_id: string;
          user_id: string;
          role: Database['public']['Enums']['member_role'];
          unread_count: number;
          last_read_msg: string | null;
          is_pinned: boolean;
          is_muted: boolean;
          mute_until: string | null;
          is_archived: boolean;
          folder_id: string | null;
          joined_at: string;
          left_at: string | null;
        },
        'conversation_id' | 'user_id',
        [
          Relationship<'conversation_members_conversation_id_fkey', ['conversation_id'], 'conversations', ['id']>,
          Relationship<'conversation_members_user_id_fkey', ['user_id'], 'users', ['id']>,
          Relationship<'conversation_members_folder_id_fkey', ['folder_id'], 'chat_folders', ['id']>,
          Relationship<'conversation_members_last_read_fk', ['last_read_msg'], 'messages', ['id']>,
        ]
      >;
      messages: Table<
        {
          id: string;
          conversation_id: string;
          sender_id: string;
          type: Database['public']['Enums']['message_type'];
          content: string | null;
          metadata: Json;
          reply_to_id: string | null;
          forwarded_from: string | null;
          is_edited: boolean;
          is_deleted: boolean;
          is_starred: boolean;
          is_pinned: boolean;
          is_view_once: boolean;
          view_once_seen: boolean;
          self_destruct: string | null;
          status: Database['public']['Enums']['message_status'];
          reactions: Json;
          ai_summary: string | null;
          ai_translation: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        'conversation_id' | 'sender_id',
        [
          Relationship<'messages_conversation_id_fkey', ['conversation_id'], 'conversations', ['id']>,
          Relationship<'messages_sender_id_fkey', ['sender_id'], 'users', ['id']>,
          Relationship<'messages_reply_to_id_fkey', ['reply_to_id'], 'messages', ['id']>,
          Relationship<'messages_forwarded_from_fkey', ['forwarded_from'], 'messages', ['id']>,
        ]
      >;
      message_receipts: Table<
        {
          id: string;
          message_id: string;
          user_id: string;
          delivered_at: string | null;
          read_at: string | null;
        },
        'message_id' | 'user_id',
        [
          Relationship<'message_receipts_message_id_fkey', ['message_id'], 'messages', ['id']>,
          Relationship<'message_receipts_user_id_fkey', ['user_id'], 'users', ['id']>,
        ]
      >;
      media: Table<
        {
          id: string;
          message_id: string | null;
          uploader_id: string;
          bucket: string;
          file_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          width: number | null;
          height: number | null;
          duration: number | null;
          waveform: number[];
          thumbnail_path: string | null;
          blurhash: string | null;
          is_encrypted: boolean;
          created_at: string;
        },
        'uploader_id' | 'file_path' | 'file_name' | 'file_size' | 'mime_type',
        [
          Relationship<'media_message_id_fkey', ['message_id'], 'messages', ['id']>,
          Relationship<'media_uploader_id_fkey', ['uploader_id'], 'users', ['id']>,
        ]
      >;
      sticker_packs: Table<
        {
          id: string;
          name: string;
          creator_id: string | null;
          cover_url: string | null;
          is_official: boolean;
          is_animated: boolean;
          created_at: string;
        },
        'name',
        [Relationship<'sticker_packs_creator_id_fkey', ['creator_id'], 'users', ['id']>]
      >;
      stickers: Table<
        {
          id: string;
          pack_id: string;
          emoji: string | null;
          file_url: string;
          file_type: 'webp' | 'png' | 'gif' | 'lottie' | 'svg';
          created_at: string;
        },
        'pack_id' | 'file_url',
        [Relationship<'stickers_pack_id_fkey', ['pack_id'], 'sticker_packs', ['id']>]
      >;
      user_sticker_packs: Table<
        { user_id: string; pack_id: string; added_at: string },
        'user_id' | 'pack_id',
        [
          Relationship<'user_sticker_packs_user_id_fkey', ['user_id'], 'users', ['id']>,
          Relationship<'user_sticker_packs_pack_id_fkey', ['pack_id'], 'sticker_packs', ['id']>,
        ]
      >;
      tasks: Table<
        {
          id: string;
          creator_id: string;
          assignee_id: string | null;
          conversation_id: string | null;
          source_msg_id: string | null;
          title: string;
          description: string | null;
          priority: Database['public']['Enums']['task_priority'];
          status: Database['public']['Enums']['task_status'];
          due_date: string | null;
          reminder_at: string | null;
          completed_at: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        },
        'creator_id' | 'title',
        [
          Relationship<'tasks_creator_id_fkey', ['creator_id'], 'users', ['id']>,
          Relationship<'tasks_assignee_id_fkey', ['assignee_id'], 'users', ['id']>,
          Relationship<'tasks_conversation_id_fkey', ['conversation_id'], 'conversations', ['id']>,
          Relationship<'tasks_source_msg_id_fkey', ['source_msg_id'], 'messages', ['id']>,
        ]
      >;
      scheduled_messages: Table<
        {
          id: string;
          sender_id: string;
          conversation_id: string;
          content: string;
          type: Database['public']['Enums']['message_type'];
          metadata: Json;
          scheduled_at: string;
          sent: boolean;
          sent_at: string | null;
          created_at: string;
        },
        'sender_id' | 'conversation_id' | 'content' | 'scheduled_at',
        [
          Relationship<'scheduled_messages_sender_id_fkey', ['sender_id'], 'users', ['id']>,
          Relationship<'scheduled_messages_conversation_id_fkey', ['conversation_id'], 'conversations', ['id']>,
        ]
      >;
      auto_replies: Table<
        {
          id: string;
          user_id: string;
          is_active: boolean;
          trigger_type: 'all' | 'keyword' | 'outside_hours';
          trigger_keywords: string[];
          reply_content: string;
          active_start: string | null;
          active_end: string | null;
          active_days: number[];
          cooldown_mins: number;
          created_at: string;
          updated_at: string;
        },
        'user_id' | 'reply_content',
        [Relationship<'auto_replies_user_id_fkey', ['user_id'], 'users', ['id']>]
      >;
      ai_logs: Table<
        {
          id: string;
          user_id: string;
          conversation_id: string | null;
          action: Database['public']['Enums']['ai_action'];
          input_tokens: number;
          output_tokens: number;
          model: string;
          prompt: string | null;
          response: string | null;
          cost_usd: number;
          latency_ms: number | null;
          created_at: string;
        },
        'user_id' | 'action' | 'model',
        [
          Relationship<'ai_logs_user_id_fkey', ['user_id'], 'users', ['id']>,
          Relationship<'ai_logs_conversation_id_fkey', ['conversation_id'], 'conversations', ['id']>,
        ]
      >;
      wallets: Table<
        {
          id: string;
          user_id: string;
          balance: number;
          currency: string;
          pin_hash: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        'user_id',
        [Relationship<'wallets_user_id_fkey', ['user_id'], 'users', ['id'], true>]
      >;
      wallet_transactions: Table<
        {
          id: string;
          wallet_id: string;
          type: Database['public']['Enums']['transaction_type'];
          amount: number;
          fee: number;
          reference_id: string | null;
          counterpart_id: string | null;
          description: string | null;
          metadata: Json;
          status: 'pending' | 'completed' | 'failed' | 'reversed';
          created_at: string;
        },
        'wallet_id' | 'type' | 'amount',
        [
          Relationship<'wallet_transactions_wallet_id_fkey', ['wallet_id'], 'wallets', ['id']>,
          Relationship<'wallet_transactions_counterpart_id_fkey', ['counterpart_id'], 'wallets', ['id']>,
        ]
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          data: Json;
          is_read: boolean;
          pushed: boolean;
          created_at: string;
        },
        'user_id' | 'type' | 'title',
        [Relationship<'notifications_user_id_fkey', ['user_id'], 'users', ['id']>]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_conversation_member: {
        Args: { target_conversation_id: string };
        Returns: boolean;
      };
      is_conversation_admin: {
        Args: { target_conversation_id: string };
        Returns: boolean;
      };
      can_send_message: {
        Args: { target_conversation_id: string };
        Returns: boolean;
      };
      can_access_message: {
        Args: { target_message_id: string };
        Returns: boolean;
      };
      can_view_profile: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      can_access_sticker_pack: {
        Args: { target_pack_id: string };
        Returns: boolean;
      };
      process_scheduled_messages: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      cleanup_expired_messages: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      set_wallet_pin: {
        Args: { new_pin_hash: string };
        Returns: undefined;
      };
      wallet_transact: {
        Args: {
          source_wallet_id: string;
          destination_user_id: string;
          transaction_amount: number;
          transaction_description: string | null;
          transaction_type: Database['public']['Enums']['transaction_type'];
          transaction_pin: string;
          transaction_reference_id: string;
        };
        Returns: Json;
      };
      create_conversation: {
        Args: {
          p_type: Database['public']['Enums']['conversation_type'];
          p_title: string | null;
          p_participant_user_ids: string[];
          p_only_admins_msg?: boolean;
        };
        Returns: string;
      };
    };
    Enums: {
      account_type: 'personal' | 'business' | 'admin';
      conversation_type: 'personal' | 'group' | 'channel' | 'self';
      member_role: 'owner' | 'admin' | 'member' | 'readonly';
      message_type:
        | 'text'
        | 'image'
        | 'video'
        | 'audio'
        | 'voice_note'
        | 'document'
        | 'sticker'
        | 'gif'
        | 'location'
        | 'contact'
        | 'poll'
        | 'system'
        | 'ai_response'
        | 'view_once'
        | 'task'
        | 'schedule'
        | 'wallet_transaction'
        | 'mini_app';
      message_status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
      folder_type: 'all' | 'unread' | 'personal' | 'work' | 'community' | 'ai_tools' | 'custom';
      task_priority: 'low' | 'medium' | 'high' | 'urgent';
      task_status: 'pending' | 'in_progress' | 'done' | 'cancelled';
      ai_action: 'summarize' | 'translate' | 'smart_reply' | 'task_extract' | 'search' | 'general_chat' | 'content_moderate';
      transaction_type: 'topup' | 'transfer' | 'payment' | 'refund' | 'cashback' | 'withdrawal';
    };
    CompositeTypes: Record<string, never>;
  };
}
