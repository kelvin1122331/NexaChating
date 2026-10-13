-- NexaChat: core schema. Auth identities remain in Supabase Auth; no password hashes are stored here.
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

DO $$ BEGIN CREATE TYPE public.account_type AS ENUM ('personal', 'business', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conversation_type AS ENUM ('personal', 'group', 'channel', 'self'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member', 'readonly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'audio', 'voice_note', 'document', 'sticker', 'gif', 'location', 'contact', 'poll', 'system', 'ai_response', 'view_once', 'task', 'schedule', 'wallet_transaction', 'mini_app'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_status AS ENUM ('sending', 'sent', 'delivered', 'read', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.folder_type AS ENUM ('all', 'unread', 'personal', 'work', 'community', 'ai_tools', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'done', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ai_action AS ENUM ('summarize', 'translate', 'smart_reply', 'task_extract', 'search', 'general_chat', 'content_moderate'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.transaction_type AS ENUM ('topup', 'transfer', 'payment', 'refund', 'cashback', 'withdrawal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone varchar(24) unique,
  email text unique,
  display_name text not null,
  username text not null,
  avatar_url text,
  bio text not null default '',
  status_text text not null default '',
  status_emoji text not null default '',
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  is_verified boolean not null default false,
  is_business boolean not null default false,
  account_type public.account_type not null default 'personal',
  locale text not null default 'en',
  timezone text not null default 'UTC',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  privacy_last_seen text not null default 'contacts' check (privacy_last_seen in ('everyone', 'contacts', 'nobody')),
  privacy_avatar text not null default 'everyone' check (privacy_avatar in ('everyone', 'contacts', 'nobody')),
  privacy_read_receipt boolean not null default true,
  privacy_screenshot boolean not null default false,
  push_token text,
  onesignal_id text,
  encryption_pub text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  contact_user_id uuid not null references public.users(id) on delete cascade,
  nickname text,
  is_favorite boolean not null default false,
  is_blocked boolean not null default false,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contacts_not_self check (user_id <> contact_user_id),
  constraint contacts_unique_pair unique (user_id, contact_user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null default 'personal',
  title text,
  description text,
  avatar_url text,
  invite_link text unique,
  is_archived boolean not null default false,
  is_pinned boolean not null default false,
  is_muted boolean not null default false,
  mute_until timestamptz,
  max_members integer not null default 256 check (max_members between 2 and 100_000),
  only_admins_msg boolean not null default false,
  disappearing integer not null default 0 check (disappearing in (0, 60, 3600, 86400, 604800, 2592000)),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  icon text not null default 'folder',
  color text not null default '#0EA5E9',
  type public.folder_type not null default 'custom',
  filter_rules jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint chat_folders_unique_name unique (user_id, name)
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.member_role not null default 'member',
  unread_count integer not null default 0 check (unread_count >= 0),
  last_read_msg uuid,
  is_pinned boolean not null default false,
  is_muted boolean not null default false,
  mute_until timestamptz,
  is_archived boolean not null default false,
  folder_id uuid references public.chat_folders(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  constraint conversation_members_unique unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete restrict,
  type public.message_type not null default 'text',
  content text,
  metadata jsonb not null default '{}'::jsonb,
  reply_to_id uuid references public.messages(id) on delete set null,
  forwarded_from uuid references public.messages(id) on delete set null,
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  is_starred boolean not null default false,
  is_pinned boolean not null default false,
  is_view_once boolean not null default false,
  view_once_seen boolean not null default false,
  self_destruct timestamptz,
  status public.message_status not null default 'sent',
  reactions jsonb not null default '[]'::jsonb,
  ai_summary text,
  ai_translation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint messages_content_or_attachment check (content is not null or metadata <> '{}'::jsonb or type in ('poll', 'location', 'contact', 'system', 'wallet_transaction', 'mini_app'))
);

alter table public.conversation_members
  add constraint conversation_members_last_read_fk
  foreign key (last_read_msg) references public.messages(id) on delete set null;

create table if not exists public.message_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  constraint message_receipts_unique unique (message_id, user_id)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete set null,
  uploader_id uuid not null references public.users(id) on delete cascade,
  bucket text not null default 'chat-media',
  file_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  mime_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration integer check (duration is null or duration >= 0),
  waveform double precision[] not null default '{}'::double precision[],
  thumbnail_path text,
  blurhash text,
  is_encrypted boolean not null default false,
  created_at timestamptz not null default now(),
  constraint media_bucket_safe check (bucket ~ '^[a-z0-9][a-z0-9_-]{1,62}$')
);

create table if not exists public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  creator_id uuid references public.users(id) on delete set null,
  cover_url text,
  is_official boolean not null default false,
  is_animated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  emoji text,
  file_url text not null,
  file_type text not null default 'webp' check (file_type in ('webp', 'png', 'gif', 'lottie', 'svg')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_sticker_packs (
  user_id uuid not null references public.users(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  assignee_id uuid references public.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  source_msg_id uuid references public.messages(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'pending',
  due_date timestamptz,
  reminder_at timestamptz,
  completed_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20_000),
  type public.message_type not null default 'text',
  metadata jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.auto_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  is_active boolean not null default false,
  trigger_type text not null default 'all' check (trigger_type in ('all', 'keyword', 'outside_hours')),
  trigger_keywords text[] not null default '{}',
  reply_content text not null check (char_length(reply_content) between 1 and 2_000),
  active_start time,
  active_end time,
  active_days integer[] not null default '{0,1,2,3,4,5,6}' check (active_days <@ array[0,1,2,3,4,5,6]),
  cooldown_mins integer not null default 60 check (cooldown_mins between 0 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  action public.ai_action not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  model text not null,
  prompt text,
  response text,
  cost_usd numeric(12, 8) not null default 0 check (cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  currency char(3) not null default 'USD',
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount <> 0),
  fee numeric(14, 2) not null default 0 check (fee >= 0),
  reference_id text,
  counterpart_id uuid references public.wallets(id) on delete set null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null check (char_length(title) between 1 and 160),
  body text,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  pushed boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists users_username_unique_ci on public.users (lower(username));
create index if not exists contacts_user_idx on public.contacts (user_id, created_at desc);
create index if not exists conversations_created_by_idx on public.conversations (created_by, updated_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id, left_at, conversation_id);
create index if not exists conversation_members_conversation_idx on public.conversation_members (conversation_id, joined_at);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc) where is_deleted = false;
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_content_trgm_idx on public.messages using gin (content gin_trgm_ops) where content is not null and is_deleted = false;
create index if not exists message_receipts_user_idx on public.message_receipts (user_id, read_at);
create index if not exists media_message_idx on public.media (message_id) where message_id is not null;
create index if not exists stickers_pack_idx on public.stickers (pack_id);
create index if not exists tasks_creator_status_idx on public.tasks (creator_id, status, due_date);
create index if not exists tasks_assignee_status_idx on public.tasks (assignee_id, status, due_date) where assignee_id is not null;
create index if not exists scheduled_messages_due_idx on public.scheduled_messages (scheduled_at) where sent = false;
create index if not exists auto_replies_user_active_idx on public.auto_replies (user_id, is_active);
create index if not exists ai_logs_user_created_idx on public.ai_logs (user_id, created_at desc);
create index if not exists wallet_transactions_wallet_created_idx on public.wallet_transactions (wallet_id, created_at desc);
create unique index if not exists wallet_transactions_reference_wallet_unique on public.wallet_transactions (wallet_id, reference_id) where reference_id is not null;
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
