begin;

do $$
declare
  keep_tables constant text[] := array[
    'perfis',
    'auditoria',
    'instances',
    'contacts',
    'chats',
    'messages',
    'group_members',
    'sync_state',
    'webhook_events',
    'chat_metrics',
    'message_status'
  ];
  keep_views constant text[] := array[]::text[];
  keep_functions constant text[] := array[
    'admin_update_user',
    'admin_delete_user',
    'mark_chat_read',
    'tg_set_updated_at',
    'tg_apply_message_to_chat_metrics',
    'tg_broadcast_chat_changes',
    'tg_broadcast_message_changes'
  ];
  keep_buckets constant text[] := array[
    'avatars'
  ];
  object_record record;
begin
  -- Remove legacy tables that do not belong to the current app.
  for object_record in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> all(keep_tables)
  loop
    execute format('drop table if exists public.%I cascade', object_record.tablename);
  end loop;

  -- Remove legacy views exposed in the public schema.
  for object_record in
    select viewname
    from pg_views
    where schemaname = 'public'
      and viewname <> all(keep_views)
  loop
    execute format('drop view if exists public.%I cascade', object_record.viewname);
  end loop;

  -- Remove legacy materialized views.
  for object_record in
    select matviewname
    from pg_matviews
    where schemaname = 'public'
      and matviewname <> all(keep_views)
  loop
    execute format('drop materialized view if exists public.%I cascade', object_record.matviewname);
  end loop;

  -- Remove legacy functions that are not part of the current app.
  for object_record in
    select p.oid::regprocedure::text as signature,
           p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public'
      and p.proname <> all(keep_functions)
      and d.objid is null
  loop
    execute format('drop function if exists public.%s cascade', object_record.signature);
  end loop;

  -- Clean storage buckets that are not part of the current app.
  delete from storage.objects
  where bucket_id <> all(keep_buckets);

  delete from storage.buckets
  where id <> all(keep_buckets);
end
$$;

commit;
