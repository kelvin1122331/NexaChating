-- Shared timestamps and auth profile provisioning.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_display_name text;
  v_username text;
begin
  v_display_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    nullif(btrim(new.phone), ''),
    'Nexa user'
  ), 80);
  v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 16);
  insert into public.users (id, display_name, username, email, phone)
  values (new.id, v_display_name, v_username, new.email, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger messages_set_updated_at before update on public.messages
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger auto_replies_set_updated_at before update on public.auto_replies
for each row execute function public.set_updated_at();
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function public.set_updated_at();

-- Prevent ordinary members from changing identity, membership, schedule ownership, or another sender's message body.
create or replace function public.guard_conversation_member_write()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_folder_owner uuid;
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.conversation_id is distinct from old.conversation_id
      or new.user_id is distinct from old.user_id
      or new.joined_at is distinct from old.joined_at then
      raise exception 'Membership identity fields are immutable' using errcode = '42501';
    end if;
    -- The message insert trigger updates other members' unread counters under a definer function.
    -- RLS prevents clients from updating another member's row directly.
    if (to_jsonb(new) - 'unread_count') = (to_jsonb(old) - 'unread_count') then return new; end if;
    if new.role is distinct from old.role and not public.is_conversation_admin(old.conversation_id) then
      raise exception 'Only conversation admins may change member roles' using errcode = '42501';
    end if;
    if old.left_at is not null and new.left_at is null and not public.is_conversation_admin(old.conversation_id) then
      raise exception 'An admin must re-add a departed member' using errcode = '42501';
    end if;
  end if;
  if new.folder_id is not null then
    select f.user_id into v_folder_owner from public.chat_folders f where f.id = new.folder_id;
    if v_folder_owner is distinct from new.user_id then
      raise exception 'Conversation folder must belong to the member' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger conversation_members_guard_write
before insert or update on public.conversation_members
for each row execute function public.guard_conversation_member_write();

create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Message identity fields are immutable' using errcode = '42501';
  end if;
  if auth.role() = 'service_role' then
    return new;
  end if;
  if auth.uid() = old.sender_id or public.is_conversation_admin(old.conversation_id) then
    return new;
  end if;
  if (to_jsonb(new) - 'reactions' - 'updated_at') = (to_jsonb(old) - 'reactions' - 'updated_at') then
    return new;
  end if;
  raise exception 'Only the sender or a conversation admin may edit a message' using errcode = '42501';
end;
$$;
create trigger messages_guard_update
before update on public.messages
for each row execute function public.guard_message_update();

create or replace function public.guard_scheduled_message_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.id is distinct from old.id
    or new.sender_id is distinct from old.sender_id
    or new.conversation_id is distinct from old.conversation_id
    or new.created_at is distinct from old.created_at
    or new.sent is distinct from old.sent
    or new.sent_at is distinct from old.sent_at then
    raise exception 'Scheduled message ownership and delivery fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger scheduled_messages_guard_update
before update on public.scheduled_messages
for each row execute function public.guard_scheduled_message_update();

create or replace function public.increment_unread_count()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
begin
  update public.conversation_members cm
  set unread_count = cm.unread_count + 1
  where cm.conversation_id = new.conversation_id
    and cm.user_id <> new.sender_id
    and cm.left_at is null;
  return new;
end;
$$;
create trigger messages_increment_unread
  after insert on public.messages
  for each row execute function public.increment_unread_count();

-- Service-role-only background functions. Both use row locks so concurrent cron workers are safe.
create or replace function public.process_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_scheduled public.scheduled_messages%rowtype;
  v_inserted integer := 0;
  v_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  for v_scheduled in
    select sm.* from public.scheduled_messages sm
    where not sm.sent and sm.scheduled_at <= now()
    order by sm.scheduled_at
    for update skip locked
    limit 100
  loop
    if exists (
      select 1 from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      where cm.conversation_id = v_scheduled.conversation_id
        and cm.user_id = v_scheduled.sender_id
        and cm.left_at is null
        and cm.role <> 'readonly'
        and (not c.only_admins_msg or cm.role in ('owner', 'admin'))
    ) then
      insert into public.messages (conversation_id, sender_id, type, content, metadata, status)
      values (v_scheduled.conversation_id, v_scheduled.sender_id, v_scheduled.type,
        v_scheduled.content, v_scheduled.metadata, 'sent');
      get diagnostics v_inserted = row_count;
      v_count := v_count + v_inserted;
    end if;
    update public.scheduled_messages
    set sent = true, sent_at = case when v_inserted = 1 then now() else null end
    where id = v_scheduled.id;
    v_inserted := 0;
  end loop;
  return v_count;
end;
$$;

create or replace function public.cleanup_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  update public.messages
  set content = null,
      metadata = '{}'::jsonb,
      reactions = '[]'::jsonb,
      is_deleted = true,
      deleted_at = now()
  where self_destruct is not null
    and self_destruct <= now()
    and not is_deleted;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Wallet PIN creation stores a bcrypt hash only. Resetting an existing PIN requires a separate verified flow.
create or replace function public.set_wallet_pin(new_pin_hash text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if new_pin_hash is null or new_pin_hash !~ '^\$2a\$12\$[./A-Za-z0-9]{53}$' then
    raise exception 'Invalid bcrypt PIN hash' using errcode = '22023';
  end if;
  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  if found and v_wallet.pin_hash is not null then
    raise exception 'Wallet PIN is already configured' using errcode = '23505';
  end if;
  insert into public.wallets (user_id, pin_hash)
  values (v_user_id, new_pin_hash)
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function public.wallet_transact(
  source_wallet_id uuid,
  destination_user_id uuid,
  transaction_amount numeric,
  transaction_description text,
  transaction_type public.transaction_type,
  transaction_pin text,
  transaction_reference_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_source public.wallets%rowtype;
  v_destination public.wallets%rowtype;
  v_source_transaction_id uuid;
  v_destination_transaction_id uuid;
  v_reference text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if transaction_type not in ('transfer', 'payment') then
    raise exception 'This transaction type is not available through wallet transfers' using errcode = '22023';
  end if;
  if destination_user_id is null or destination_user_id = auth.uid() then
    raise exception 'Choose a different wallet recipient' using errcode = '22023';
  end if;
  if transaction_amount is null or transaction_amount <= 0 or transaction_amount > 1000000
    or transaction_amount <> round(transaction_amount, 2) then
    raise exception 'Invalid transaction amount' using errcode = '22023';
  end if;
  if transaction_pin is null or transaction_pin !~ '^[0-9]{4,8}$' then
    raise exception 'Invalid wallet PIN' using errcode = '22023';
  end if;
  if transaction_reference_id is null or transaction_reference_id !~ '^[A-Za-z0-9._:-]{8,96}$' then
    raise exception 'Invalid transaction reference' using errcode = '22023';
  end if;
  v_reference := transaction_reference_id;

  -- Lock wallets in deterministic order to avoid deadlocks under concurrent transfers.
  perform w.id from public.wallets w
  where w.user_id in (auth.uid(), destination_user_id)
  order by w.id
  for update;

  select * into v_source from public.wallets w
  where w.id = source_wallet_id and w.user_id = auth.uid() and w.is_active;
  if not found then raise exception 'Source wallet is unavailable' using errcode = 'P0002'; end if;
  if v_source.pin_hash is null or crypt(transaction_pin, v_source.pin_hash) <> v_source.pin_hash then
    raise exception 'Wallet PIN did not match' using errcode = '42501';
  end if;

  select * into v_destination from public.wallets w
  where w.user_id = destination_user_id and w.is_active;
  if not found then raise exception 'Recipient wallet is unavailable' using errcode = 'P0002'; end if;
  if v_source.currency <> v_destination.currency then
    raise exception 'Wallet currencies do not match' using errcode = '22023';
  end if;
  if v_source.balance < transaction_amount then
    raise exception 'Insufficient wallet balance' using errcode = '23514';
  end if;

  select wt.id into v_source_transaction_id from public.wallet_transactions wt
  where wt.wallet_id = v_source.id and wt.reference_id = v_reference || ':sender';
  if found then
    return jsonb_build_object('success', true, 'duplicate', true, 'referenceId', v_reference,
      'transactionId', v_source_transaction_id, 'balance', v_source.balance);
  end if;

  update public.wallets set balance = balance - transaction_amount, updated_at = now() where id = v_source.id;
  update public.wallets set balance = balance + transaction_amount, updated_at = now() where id = v_destination.id;
  insert into public.wallet_transactions (wallet_id, type, amount, reference_id, counterpart_id, description, metadata)
  values (v_source.id, transaction_type, -transaction_amount, v_reference || ':sender', v_destination.id,
    left(nullif(btrim(transaction_description), ''), 240), jsonb_build_object('direction', 'outgoing'))
  returning id into v_source_transaction_id;
  insert into public.wallet_transactions (wallet_id, type, amount, reference_id, counterpart_id, description, metadata)
  values (v_destination.id, transaction_type, transaction_amount, v_reference || ':recipient', v_source.id,
    left(nullif(btrim(transaction_description), ''), 240), jsonb_build_object('direction', 'incoming'))
  returning id into v_destination_transaction_id;

  return jsonb_build_object('success', true, 'duplicate', false, 'referenceId', v_reference,
    'transactionId', v_source_transaction_id, 'counterpartTransactionId', v_destination_transaction_id,
    'balance', v_source.balance - transaction_amount);
end;
$$;

revoke all on function public.process_scheduled_messages() from public, anon, authenticated;
revoke all on function public.cleanup_expired_messages() from public, anon, authenticated;
revoke all on function public.wallet_transact(uuid, uuid, numeric, text, public.transaction_type, text, text) from public, anon;
revoke all on function public.set_wallet_pin(text) from public, anon;
grant execute on function public.process_scheduled_messages() to service_role;
grant execute on function public.cleanup_expired_messages() to service_role;
grant execute on function public.wallet_transact(uuid, uuid, numeric, text, public.transaction_type, text, text) to authenticated, service_role;
grant execute on function public.set_wallet_pin(text) to authenticated;

-- Conversation creation is atomic so a partially-added group is never visible.
create or replace function public.create_conversation(
  p_type public.conversation_type,
  p_title text,
  p_participant_user_ids uuid[],
  p_only_admins_msg boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_participants uuid[];
  v_conversation_id uuid;
  v_member_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_type not in ('personal', 'group', 'channel', 'self') then raise exception 'Unsupported conversation type' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct requested.user_id order by requested.user_id), '{}'::uuid[])
    into v_participants
  from unnest(coalesce(p_participant_user_ids, '{}'::uuid[]) || array[v_user_id]) as requested(user_id);
  v_member_count := cardinality(v_participants);
  if v_member_count < 1 or v_member_count > 256 then raise exception 'Conversation member count is invalid' using errcode = '22023'; end if;
  if p_type = 'self' and v_member_count <> 1 then raise exception 'A saved-messages conversation only has one member' using errcode = '22023'; end if;
  if p_type = 'personal' and v_member_count <> 2 then raise exception 'A personal conversation requires exactly two members' using errcode = '22023'; end if;
  if p_type in ('group', 'channel') and v_member_count < 2 then raise exception 'A group or channel requires at least two members' using errcode = '22023'; end if;
  if exists (
    select 1 from unnest(v_participants) requested(user_id)
    where not exists (select 1 from public.users u where u.id = requested.user_id and u.deleted_at is null)
  ) then raise exception 'One or more selected accounts are unavailable' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.contacts c
    where c.is_blocked and (
      (c.user_id = v_user_id and c.contact_user_id = any(v_participants))
      or (c.contact_user_id = v_user_id and c.user_id = any(v_participants))
    )
  ) then raise exception 'A blocked account cannot be added to this conversation' using errcode = '42501'; end if;

  if p_type = 'personal' then
    perform pg_advisory_xact_lock(hashtextextended(array_to_string(v_participants, ':'), 0));
    select c.id into v_conversation_id
    from public.conversations c
    where c.type = 'personal'
      and (select count(*) from public.conversation_members cm where cm.conversation_id = c.id and cm.left_at is null) = 2
      and (select count(*) from public.conversation_members cm where cm.conversation_id = c.id and cm.left_at is null and cm.user_id = any(v_participants)) = 2
    order by c.created_at
    limit 1;
    if found then return v_conversation_id; end if;
  end if;

  insert into public.conversations (type, title, created_by, max_members, only_admins_msg)
  values (
    p_type,
    case when p_type in ('group', 'channel') then left(nullif(btrim(p_title), ''), 80) else null end,
    v_user_id,
    greatest(v_member_count, 2),
    coalesce(p_only_admins_msg, false)
  )
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conversation_id, v_user_id, 'owner');
  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conversation_id, requested.user_id, 'member'
  from unnest(v_participants) requested(user_id)
  where requested.user_id <> v_user_id;
  return v_conversation_id;
end;
$$;

revoke all on function public.create_conversation(public.conversation_type, text, uuid[], boolean) from public, anon;
grant execute on function public.create_conversation(public.conversation_type, text, uuid[], boolean) to authenticated;

-- Make the user-scoped tables available through Supabase Realtime without exposing other tables.
alter table public.messages replica identity full;
alter table public.conversation_members replica identity full;
alter table public.notifications replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_members') then
      execute 'alter publication supabase_realtime add table public.conversation_members';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      execute 'alter publication supabase_realtime add table public.notifications';
    end if;
  end if;
end;
$$;
