begin;

drop table if exists public.message_status cascade;
drop table if exists public.chat_metrics cascade;
drop table if exists public.webhook_events cascade;
drop table if exists public.sync_state cascade;
drop table if exists public.group_members cascade;
drop table if exists public.messages cascade;
drop table if exists public.chats cascade;
drop table if exists public.contacts cascade;
drop table if exists public.instances cascade;

drop function if exists public.mark_chat_read(uuid, timestamptz) cascade;
drop function if exists public.tg_apply_message_to_chat_metrics() cascade;

commit;
