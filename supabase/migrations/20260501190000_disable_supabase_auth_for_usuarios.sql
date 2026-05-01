alter table public."USUARIOS"
drop constraint if exists "USUARIOS_id_fkey";

alter table public."USUARIOS"
add column if not exists senha_hash text;

alter table public."USUARIOS"
alter column senha_hash drop not null;

drop policy if exists "usuarios_insert_own_profile" on public."USUARIOS";
drop policy if exists "usuarios_update_own_profile" on public."USUARIOS";
drop policy if exists "usuarios_delete_own_profile" on public."USUARIOS";

create or replace function public.usuarios_cadastrar(
  p_email text,
  p_senha text,
  p_nome_completo text,
  p_organizacao text default null,
  p_avatar_url text default null
)
returns table (
  id uuid,
  email text,
  nome_completo text,
  organizacao text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email = '' or p_senha = '' or trim(p_nome_completo) = '' then
    raise exception 'Dados obrigatorios ausentes.';
  end if;

  if exists (select 1 from public."USUARIOS" u where u.email = v_email) then
    raise exception 'E-mail ja cadastrado.';
  end if;

  return query
  insert into public."USUARIOS" (
    id,
    email,
    nome_completo,
    organizacao,
    avatar_url,
    senha_hash
  )
  values (
    gen_random_uuid(),
    v_email,
    upper(trim(p_nome_completo)),
    nullif(upper(trim(coalesce(p_organizacao, ''))), ''),
    p_avatar_url,
    extensions.crypt(p_senha, extensions.gen_salt('bf'))
  )
  returning
    "USUARIOS".id,
    "USUARIOS".email,
    "USUARIOS".nome_completo,
    "USUARIOS".organizacao,
    "USUARIOS".avatar_url,
    "USUARIOS".created_at,
    "USUARIOS".updated_at;
end;
$$;

create or replace function public.usuarios_login(
  p_email text,
  p_senha text
)
returns table (
  id uuid,
  email text,
  nome_completo text,
  organizacao text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    u.id,
    u.email,
    u.nome_completo,
    u.organizacao,
    u.avatar_url,
    u.created_at,
    u.updated_at
  from public."USUARIOS" u
  where u.email = lower(trim(p_email))
    and u.senha_hash = extensions.crypt(p_senha, u.senha_hash)
  limit 1;
end;
$$;

create or replace function public.usuarios_atualizar_senha(
  p_email text,
  p_senha text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."USUARIOS"
  set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf'))
  where email = lower(trim(p_email));

  if not found then
    raise exception 'E-mail nao encontrado.';
  end if;
end;
$$;

grant execute on function public.usuarios_cadastrar(text, text, text, text, text) to anon, authenticated;
grant execute on function public.usuarios_login(text, text) to anon, authenticated;
grant execute on function public.usuarios_atualizar_senha(text, text) to anon, authenticated;

drop policy if exists "avatars_insert_authenticated" on storage.objects;
drop policy if exists "avatars_insert_public" on storage.objects;
create policy "avatars_insert_public"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'avatars');

drop policy if exists "avatars_update_authenticated" on storage.objects;
drop policy if exists "avatars_update_public" on storage.objects;
create policy "avatars_update_public"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');
