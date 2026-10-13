-- Security-definer helpers avoid recursive RLS checks while exposing only boolean membership decisions.
create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
  );
$$;

create or replace function public.is_conversation_admin(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
      and cm.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_send_message(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = target_conversation_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
      and cm.role <> 'readonly'
      and (not c.only_admins_msg or cm.role in ('owner', 'admin'))
  );
$$;

create or replace function public.can_access_message(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = target_message_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
  );
$$;

create or replace function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = target_user_id and u.deleted_at is null
    );
$$;

create or replace function public.can_access_sticker_pack(target_pack_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  -- Sticker packs are public unless a future schema version adds explicit visibility controls.
  select exists (select 1 from public.sticker_packs p where p.id = target_pack_id);
$$;

revoke all on function public.is_conversation_member(uuid) from public, anon;
revoke all on function public.is_conversation_admin(uuid) from public, anon;
revoke all on function public.can_send_message(uuid) from public, anon;
revoke all on function public.can_access_message(uuid) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;
revoke all on function public.can_access_sticker_pack(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated, service_role;
grant execute on function public.is_conversation_admin(uuid) to authenticated, service_role;
grant execute on function public.can_send_message(uuid) to authenticated, service_role;
grant execute on function public.can_access_message(uuid) to authenticated, service_role;
grant execute on function public.can_view_profile(uuid) to authenticated, service_role;
grant execute on function public.can_access_sticker_pack(uuid) to authenticated, service_role;

alter table public.users enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.media enable row level security;
alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;
alter table public.user_sticker_packs enable row level security;
alter table public.chat_folders enable row level security;
alter table public.tasks enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.auto_replies enable row level security;
alter table public.ai_logs enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.notifications enable row level security;

create policy users_select_visible on public.users
  for select to authenticated using (public.can_view_profile(id));
create policy users_insert_self on public.users
  for insert to authenticated with check (id = auth.uid());
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy contacts_select_own on public.contacts
  for select to authenticated using (user_id = auth.uid());
create policy contacts_insert_own on public.contacts
  for insert to authenticated with check (
    user_id = auth.uid() and contact_user_id <> auth.uid() and public.can_view_profile(contact_user_id)
  );
create policy contacts_update_own on public.contacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy contacts_delete_own on public.contacts
  for delete to authenticated using (user_id = auth.uid());

create policy conversations_select_member on public.conversations
  for select to authenticated using (public.is_conversation_member(id));
create policy conversations_insert_creator on public.conversations
  for insert to authenticated with check (created_by = auth.uid());
create policy conversations_update_admin on public.conversations
  for update to authenticated using (public.is_conversation_admin(id)) with check (public.is_conversation_admin(id));
create policy conversations_delete_owner on public.conversations
  for delete to authenticated using (created_by = auth.uid() and public.is_conversation_admin(id));

create policy conversation_members_select_related on public.conversation_members
  for select to authenticated using (user_id = auth.uid() or public.is_conversation_member(conversation_id));
create policy conversation_members_insert_admin_or_creator on public.conversation_members
  for insert to authenticated with check (
    public.is_conversation_admin(conversation_id)
    or (user_id = auth.uid() and exists (
      select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()
    ))
  );
create policy conversation_members_update_self_or_admin on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid() or public.is_conversation_admin(conversation_id))
  with check (user_id = auth.uid() or public.is_conversation_admin(conversation_id));
create policy conversation_members_delete_self_or_admin on public.conversation_members
  for delete to authenticated using (user_id = auth.uid() or public.is_conversation_admin(conversation_id));

create policy messages_select_member on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));
create policy messages_insert_sender on public.messages
  for insert to authenticated with check (sender_id = auth.uid() and public.can_send_message(conversation_id));
create policy messages_update_member on public.messages
  for update to authenticated using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));
create policy messages_delete_sender_or_admin on public.messages
  for delete to authenticated using (sender_id = auth.uid() or public.is_conversation_admin(conversation_id));

create policy receipts_select_related on public.message_receipts
  for select to authenticated using (user_id = auth.uid() or public.can_access_message(message_id));
create policy receipts_insert_self on public.message_receipts
  for insert to authenticated with check (user_id = auth.uid() and public.can_access_message(message_id));
create policy receipts_update_self on public.message_receipts
  for update to authenticated using (user_id = auth.uid() and public.can_access_message(message_id))
  with check (user_id = auth.uid() and public.can_access_message(message_id));

create policy media_select_related on public.media
  for select to authenticated using (uploader_id = auth.uid() or (message_id is not null and public.can_access_message(message_id)));
create policy media_insert_own on public.media
  for insert to authenticated with check (
    uploader_id = auth.uid() and (message_id is null or public.can_access_message(message_id))
  );
create policy media_update_own on public.media
  for update to authenticated using (uploader_id = auth.uid()) with check (uploader_id = auth.uid());
create policy media_delete_own on public.media
  for delete to authenticated using (uploader_id = auth.uid());

create policy sticker_packs_select_available on public.sticker_packs
  for select to authenticated using (is_official or creator_id = auth.uid() or public.can_access_sticker_pack(id));
create policy sticker_packs_insert_creator on public.sticker_packs
  for insert to authenticated with check (creator_id = auth.uid() and not is_official);
create policy sticker_packs_update_creator on public.sticker_packs
  for update to authenticated using (creator_id = auth.uid() and not is_official)
  with check (creator_id = auth.uid() and not is_official);
create policy sticker_packs_delete_creator on public.sticker_packs
  for delete to authenticated using (creator_id = auth.uid() and not is_official);

create policy stickers_select_available on public.stickers
  for select to authenticated using (public.can_access_sticker_pack(pack_id));
create policy stickers_insert_pack_creator on public.stickers
  for insert to authenticated with check (exists (
    select 1 from public.sticker_packs p where p.id = pack_id and p.creator_id = auth.uid() and not p.is_official
  ));
create policy stickers_update_pack_creator on public.stickers
  for update to authenticated using (exists (
    select 1 from public.sticker_packs p where p.id = pack_id and p.creator_id = auth.uid() and not p.is_official
  )) with check (exists (
    select 1 from public.sticker_packs p where p.id = pack_id and p.creator_id = auth.uid() and not p.is_official
  ));
create policy stickers_delete_pack_creator on public.stickers
  for delete to authenticated using (exists (
    select 1 from public.sticker_packs p where p.id = pack_id and p.creator_id = auth.uid() and not p.is_official
  ));

create policy user_sticker_packs_select_self on public.user_sticker_packs
  for select to authenticated using (user_id = auth.uid());
create policy user_sticker_packs_insert_self on public.user_sticker_packs
  for insert to authenticated with check (user_id = auth.uid() and public.can_access_sticker_pack(pack_id));
create policy user_sticker_packs_delete_self on public.user_sticker_packs
  for delete to authenticated using (user_id = auth.uid());

create policy chat_folders_all_self on public.chat_folders
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy tasks_select_related on public.tasks
  for select to authenticated using (
    creator_id = auth.uid() or assignee_id = auth.uid()
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  );
create policy tasks_insert_creator on public.tasks
  for insert to authenticated with check (
    creator_id = auth.uid()
    and (conversation_id is null or public.is_conversation_member(conversation_id))
    and (source_msg_id is null or public.can_access_message(source_msg_id))
  );
create policy tasks_update_creator_or_assignee on public.tasks
  for update to authenticated using (creator_id = auth.uid() or assignee_id = auth.uid())
  with check (creator_id = auth.uid() or assignee_id = auth.uid());
create policy tasks_delete_creator on public.tasks
  for delete to authenticated using (creator_id = auth.uid());

create policy scheduled_messages_select_sender on public.scheduled_messages
  for select to authenticated using (sender_id = auth.uid());
create policy scheduled_messages_insert_sender on public.scheduled_messages
  for insert to authenticated with check (sender_id = auth.uid() and public.can_send_message(conversation_id));
create policy scheduled_messages_update_sender on public.scheduled_messages
  for update to authenticated using (sender_id = auth.uid() and not sent)
  with check (sender_id = auth.uid() and not sent);
create policy scheduled_messages_delete_sender on public.scheduled_messages
  for delete to authenticated using (sender_id = auth.uid() and not sent);

create policy auto_replies_all_self on public.auto_replies
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ai_logs_select_self on public.ai_logs
  for select to authenticated using (user_id = auth.uid());
create policy ai_logs_insert_self on public.ai_logs
  for insert to authenticated with check (user_id = auth.uid());

create policy wallets_select_self on public.wallets
  for select to authenticated using (user_id = auth.uid());
create policy wallets_insert_own on public.wallets
  for insert to authenticated with check (user_id = auth.uid());

create policy wallet_transactions_select_owner on public.wallet_transactions
  for select to authenticated using (
    wallet_id in (select w.id from public.wallets w where w.user_id = auth.uid())
    or counterpart_id in (select w.id from public.wallets w where w.user_id = auth.uid())
  );

create policy notifications_select_self on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_insert_self on public.notifications
  for insert to authenticated with check (user_id = auth.uid());
create policy notifications_update_self on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_self on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- Avoid public/anonymous table access; column grants below keep private account fields and wallet PIN hashes server-only.
revoke all on all tables in schema public from anon;
revoke all on table public.users, public.wallets, public.wallet_transactions from authenticated;
grant select (id, display_name, username, avatar_url, bio, status_text, status_emoji, is_online, last_seen_at,
  is_verified, is_business, account_type, locale, timezone, theme, privacy_last_seen, privacy_avatar,
  privacy_read_receipt, privacy_screenshot, created_at, updated_at) on public.users to authenticated;
grant insert (id, display_name, username, avatar_url, bio, status_text, status_emoji, locale, timezone, theme, encryption_pub)
  on public.users to authenticated;
grant update (display_name, username, avatar_url, bio, status_text, status_emoji, is_online, last_seen_at,
  locale, timezone, theme, privacy_last_seen, privacy_avatar, privacy_read_receipt, privacy_screenshot,
  push_token, onesignal_id, encryption_pub) on public.users to authenticated;
grant select (id, user_id, balance, currency, is_active, created_at, updated_at) on public.wallets to authenticated;
grant insert (user_id, currency) on public.wallets to authenticated;
grant select on public.wallet_transactions to authenticated;

grant select, insert, update, delete on public.contacts, public.conversations, public.conversation_members,
  public.messages, public.message_receipts, public.media, public.sticker_packs, public.stickers,
  public.user_sticker_packs, public.chat_folders, public.tasks, public.scheduled_messages,
  public.auto_replies, public.ai_logs, public.notifications to authenticated;
grant usage on schema public to authenticated;

-- All chat files are private. Uploads must be under the authenticated user's UUID folder;
-- reads are granted only after a matching RLS-visible media row is created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media', 'chat-media', false, 104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav', 'application/pdf',
    'text/plain', 'application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy chat_media_upload_own_folder on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy chat_media_read_visible on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-media' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.media m
        where m.bucket = bucket_id and (m.file_path = name or m.thumbnail_path = name)
      )
    )
  );
create policy chat_media_update_own_folder on storage.objects
  for update to authenticated using (
    bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy chat_media_delete_own_folder on storage.objects
  for delete to authenticated using (
    bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
