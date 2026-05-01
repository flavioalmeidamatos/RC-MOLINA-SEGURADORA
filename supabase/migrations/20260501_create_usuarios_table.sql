create extension if not exists pgcrypto;

create table if not exists public."USUARIOS" (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome_completo text not null,
  organizacao text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usuarios_email_idx on public."USUARIOS" (email);
create index if not exists usuarios_nome_completo_idx on public."USUARIOS" (nome_completo);

create or replace function public.set_usuarios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_usuarios_updated_at on public."USUARIOS";
create trigger set_usuarios_updated_at
before update on public."USUARIOS"
for each row
execute function public.set_usuarios_updated_at();

alter table public."USUARIOS" enable row level security;

drop policy if exists "usuarios_select_authenticated" on public."USUARIOS";
create policy "usuarios_select_authenticated"
on public."USUARIOS"
for select
to anon, authenticated
using (true);

drop policy if exists "usuarios_insert_own_profile" on public."USUARIOS";
create policy "usuarios_insert_own_profile"
on public."USUARIOS"
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "usuarios_update_own_profile" on public."USUARIOS";
create policy "usuarios_update_own_profile"
on public."USUARIOS"
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "usuarios_delete_own_profile" on public."USUARIOS";
create policy "usuarios_delete_own_profile"
on public."USUARIOS"
for delete
to authenticated
using (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_authenticated" on storage.objects;
create policy "avatars_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars');

drop policy if exists "avatars_update_authenticated" on storage.objects;
create policy "avatars_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');

do $$
begin
  if to_regclass('public.perfis') is not null then
    insert into public."USUARIOS" (id, email, nome_completo, organizacao, avatar_url, created_at, updated_at)
    select
      id,
      email,
      nome_completo,
      organizacao,
      avatar_url,
      coalesce(created_at, now()),
      coalesce(updated_at, now())
    from public.perfis
    on conflict (id) do update set
      email = excluded.email,
      nome_completo = excluded.nome_completo,
      organizacao = excluded.organizacao,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  end if;
end $$;

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public."USUARIOS"(id) on delete set null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_insert_authenticated" on public.auditoria;
create policy "auditoria_insert_authenticated"
on public.auditoria
for insert
to authenticated
with check (true);

create or replace function public.admin_update_user(
  p_id uuid,
  p_nome text,
  p_email text,
  p_org text,
  p_avatar_url text,
  p_admin_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_hash constant text := '92bdea102b044dfc646c30841c2dd350c777b0d9431753def74336af64964fd5';
begin
  if p_admin_hash is distinct from v_admin_hash then
    raise exception 'Senha administrativa invalida.';
  end if;

  update public."USUARIOS"
  set
    nome_completo = p_nome,
    email = lower(trim(p_email)),
    organizacao = nullif(p_org, ''),
    avatar_url = p_avatar_url
  where id = p_id;
end;
$$;

create or replace function public.admin_delete_user(
  p_id uuid,
  p_admin_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_hash constant text := '92bdea102b044dfc646c30841c2dd350c777b0d9431753def74336af64964fd5';
begin
  if p_admin_hash is distinct from v_admin_hash then
    raise exception 'Senha administrativa invalida.';
  end if;

  delete from public."USUARIOS"
  where id = p_id;
end;
$$;
