create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.instances (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  green_instance_id text not null unique,
  api_base_url text,
  media_base_url text,
  label text not null,
  phone_number text,
  state text not null default 'unknown',
  status text not null default 'unknown',
  is_connected boolean not null default false,
  last_qr_hash text,
  last_qr_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instances_owner_user_id
  on public.instances (owner_user_id);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  wa_id text not null,
  phone_e164 text,
  type text not null default 'user' check (type in ('user', 'group', 'broadcast', 'unknown')),
  profile_name text,
  contact_name text,
  resolved_name text not null,
  avatar_url text,
  avatar_etag text,
  is_business boolean not null default false,
  is_blocked boolean not null default false,
  last_seen_at timestamptz,
  last_synced_at timestamptz not null default now(),
  search_text text generated always as (
    lower(
      coalesce(contact_name, '') || ' ' ||
      coalesce(profile_name, '') || ' ' ||
      coalesce(resolved_name, '') || ' ' ||
      coalesce(phone_e164, '') || ' ' ||
      coalesce(wa_id, '')
    )
  ) stored,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, wa_id)
);

create index if not exists idx_contacts_instance_type_name
  on public.contacts (instance_id, type, resolved_name);

create index if not exists idx_contacts_search_text_trgm
  on public.contacts using gin (search_text gin_trgm_ops);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  chat_wa_id text not null,
  chat_type text not null default 'unknown' check (chat_type in ('user', 'group', 'broadcast', 'unknown')),
  subject text,
  resolved_title text not null,
  avatar_url text,
  is_archived boolean not null default false,
  is_muted boolean not null default false,
  last_message_id uuid,
  last_message_preview text,
  last_message_kind text,
  last_message_at timestamptz,
  sort_ts timestamptz not null default now(),
  unread_count integer not null default 0,
  last_read_message_ts timestamptz,
  last_incoming_message_ts timestamptz,
  participants_count integer not null default 0,
  message_count bigint not null default 0,
  is_directory_only boolean not null default true,
  needs_reconcile boolean not null default false,
  search_text text generated always as (
    lower(
      coalesce(resolved_title, '') || ' ' ||
      coalesce(subject, '') || ' ' ||
      coalesce(last_message_preview, '') || ' ' ||
      coalesce(chat_wa_id, '')
    )
  ) stored,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, chat_wa_id)
);

create index if not exists idx_chats_home
  on public.chats (instance_id, is_archived, sort_ts desc, id desc);

create index if not exists idx_chats_unread
  on public.chats (instance_id, unread_count desc, sort_ts desc);

create index if not exists idx_chats_search_text_trgm
  on public.chats using gin (search_text gin_trgm_ops);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  external_message_id text not null,
  stanza_id text,
  wa_chat_id text not null,
  sender_wa_id text,
  sender_contact_id uuid references public.contacts(id) on delete set null,
  quoted_message_id uuid references public.messages(id) on delete set null,
  direction text not null check (direction in ('incoming', 'outgoing', 'system')),
  kind text not null default 'unknown' check (
    kind in (
      'text', 'extended_text', 'image', 'video', 'audio', 'document',
      'sticker', 'contact', 'location', 'poll', 'reaction', 'system', 'unknown'
    )
  ),
  body_text text,
  preview_text text,
  caption_text text,
  media_url text,
  thumbnail_url text,
  mime_type text,
  file_name text,
  status text,
  is_from_me boolean not null default false,
  sent_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, external_message_id)
);

create index if not exists idx_messages_chat_page
  on public.messages (chat_id, sent_at desc, id desc);

create index if not exists idx_messages_instance_chat_page
  on public.messages (instance_id, wa_chat_id, sent_at desc);

create index if not exists idx_messages_instance_received
  on public.messages (instance_id, server_received_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chats_last_message_id_fkey'
  ) then
    alter table public.chats
      add constraint chats_last_message_id_fkey
      foreign key (last_message_id) references public.messages(id) on delete set null;
  end if;
end
$$;

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  group_chat_id uuid not null references public.chats(id) on delete cascade,
  member_wa_id text not null,
  member_contact_id uuid references public.contacts(id) on delete set null,
  role text not null default 'member' check (role in ('member', 'admin', 'superadmin')),
  joined_at timestamptz,
  left_at timestamptz,
  is_active boolean not null default true,
  display_name text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, group_chat_id, member_wa_id)
);

create index if not exists idx_group_members_group_active
  on public.group_members (group_chat_id, is_active);

create table if not exists public.sync_state (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  scope text not null check (
    scope in (
      'directory', 'contacts', 'groups', 'messages_recent',
      'messages_history', 'avatars', 'group_members', 'webhook', 'reconcile'
    )
  ),
  entity_key text not null default '_',
  cursor_ts timestamptz,
  cursor_message_id text,
  cursor_receipt_id bigint,
  last_success_at timestamptz,
  last_started_at timestamptz,
  last_error text,
  retry_count integer not null default 0,
  lock_token uuid,
  locked_at timestamptz,
  backoff_until timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, scope, entity_key)
);

create index if not exists idx_sync_state_scope
  on public.sync_state (instance_id, scope, last_success_at desc);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  provider text not null default 'green_api',
  event_type text not null,
  dedupe_key text not null,
  external_event_id text,
  wa_chat_id text,
  wa_message_id text,
  payload jsonb not null,
  process_status text not null default 'pending' check (process_status in ('pending', 'processed', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  error_message text,
  unique (instance_id, dedupe_key)
);

create index if not exists idx_webhook_events_retry
  on public.webhook_events (process_status, next_retry_at, received_at);

create index if not exists idx_webhook_events_instance_received
  on public.webhook_events (instance_id, received_at desc);

create table if not exists public.chat_metrics (
  chat_id uuid primary key references public.chats(id) on delete cascade,
  instance_id uuid not null references public.instances(id) on delete cascade,
  unread_count integer not null default 0,
  last_read_message_ts timestamptz,
  last_delivered_message_ts timestamptz,
  last_seen_message_ts timestamptz,
  first_unread_message_id uuid references public.messages(id) on delete set null,
  message_count bigint not null default 0,
  incoming_count bigint not null default 0,
  outgoing_count bigint not null default 0,
  oldest_loaded_message_ts timestamptz,
  newest_loaded_message_ts timestamptz,
  sync_lag_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_metrics_instance_unread
  on public.chat_metrics (instance_id, unread_count desc, updated_at desc);

create table if not exists public.message_status (
  id bigserial primary key,
  instance_id uuid not null references public.instances(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  status text not null,
  occurred_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  unique (message_id, status)
);

create index if not exists idx_message_status_message
  on public.message_status (instance_id, message_id, occurred_at desc);

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_instances_updated_at on public.instances;
create trigger trg_instances_updated_at
before update on public.instances
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_chats_updated_at on public.chats;
create trigger trg_chats_updated_at
before update on public.chats
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_messages_updated_at on public.messages;
create trigger trg_messages_updated_at
before update on public.messages
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_group_members_updated_at on public.group_members;
create trigger trg_group_members_updated_at
before update on public.group_members
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_sync_state_updated_at on public.sync_state;
create trigger trg_sync_state_updated_at
before update on public.sync_state
for each row execute function public.tg_set_updated_at();

create or replace function public.tg_apply_message_to_chat_metrics()
returns trigger
language plpgsql
as $$
declare
  v_preview text;
begin
  v_preview := coalesce(nullif(new.preview_text, ''), left(coalesce(new.body_text, ''), 160), new.kind);

  update public.chats
     set last_message_id = case
           when last_message_at is null or new.sent_at >= last_message_at then new.id
           else last_message_id
         end,
         last_message_preview = case
           when last_message_at is null or new.sent_at >= last_message_at then v_preview
           else last_message_preview
         end,
         last_message_kind = case
           when last_message_at is null or new.sent_at >= last_message_at then new.kind
           else last_message_kind
         end,
         last_message_at = greatest(coalesce(last_message_at, to_timestamp(0)), new.sent_at),
         sort_ts = greatest(coalesce(sort_ts, to_timestamp(0)), new.sent_at),
         last_incoming_message_ts = case
           when new.direction = 'incoming'
             then greatest(coalesce(last_incoming_message_ts, to_timestamp(0)), new.sent_at)
           else last_incoming_message_ts
         end,
         unread_count = case
           when new.direction = 'incoming' and not coalesce(new.is_from_me, false)
             then unread_count + 1
           else unread_count
         end,
         message_count = message_count + 1,
         is_directory_only = false,
         needs_reconcile = false,
         updated_at = now()
   where id = new.chat_id;

  insert into public.chat_metrics (
    chat_id,
    instance_id,
    unread_count,
    message_count,
    incoming_count,
    outgoing_count,
    oldest_loaded_message_ts,
    newest_loaded_message_ts,
    updated_at
  )
  values (
    new.chat_id,
    new.instance_id,
    case when new.direction = 'incoming' and not coalesce(new.is_from_me, false) then 1 else 0 end,
    1,
    case when new.direction = 'incoming' then 1 else 0 end,
    case when new.direction = 'outgoing' then 1 else 0 end,
    new.sent_at,
    new.sent_at,
    now()
  )
  on conflict (chat_id) do update
     set unread_count = case
           when new.direction = 'incoming' and not coalesce(new.is_from_me, false)
             then public.chat_metrics.unread_count + 1
           else public.chat_metrics.unread_count
         end,
         message_count = public.chat_metrics.message_count + 1,
         incoming_count = public.chat_metrics.incoming_count + case when new.direction = 'incoming' then 1 else 0 end,
         outgoing_count = public.chat_metrics.outgoing_count + case when new.direction = 'outgoing' then 1 else 0 end,
         oldest_loaded_message_ts = least(coalesce(public.chat_metrics.oldest_loaded_message_ts, new.sent_at), new.sent_at),
         newest_loaded_message_ts = greatest(coalesce(public.chat_metrics.newest_loaded_message_ts, new.sent_at), new.sent_at),
         updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_messages_apply_metrics on public.messages;
create trigger trg_messages_apply_metrics
after insert on public.messages
for each row execute function public.tg_apply_message_to_chat_metrics();

create or replace function public.mark_chat_read(
  p_chat_id uuid,
  p_last_read_ts timestamptz default now()
)
returns void
language plpgsql
as $$
begin
  update public.chats
     set unread_count = 0,
         last_read_message_ts = p_last_read_ts,
         updated_at = now()
   where id = p_chat_id;

  update public.chat_metrics
     set unread_count = 0,
         last_read_message_ts = p_last_read_ts,
         updated_at = now()
   where chat_id = p_chat_id;
end;
$$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.chats;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.messages;
  exception
    when duplicate_object then null;
  end;
end
$$;
