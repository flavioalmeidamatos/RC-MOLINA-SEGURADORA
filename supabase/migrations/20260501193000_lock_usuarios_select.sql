drop policy if exists "usuarios_select_authenticated" on public."USUARIOS";

create or replace function public.usuarios_email_existe(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."USUARIOS"
    where email = lower(trim(p_email))
  );
$$;

create or replace function public.usuarios_perfil(p_id uuid)
returns table (
  id uuid,
  email text,
  nome_completo text,
  organizacao text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.email,
    u.nome_completo,
    u.organizacao,
    u.avatar_url,
    u.created_at,
    u.updated_at
  from public."USUARIOS" u
  where u.id = p_id
  limit 1;
$$;

create or replace function public.usuarios_perfil_por_email(p_email text)
returns table (
  id uuid,
  email text,
  nome_completo text,
  organizacao text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
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
  limit 1;
$$;

create or replace function public.admin_list_users(p_admin_hash text)
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
  v_admin_hash constant text := '92bdea102b044dfc646c30841c2dd350c777b0d9431753def74336af64964fd5';
begin
  if p_admin_hash is distinct from v_admin_hash then
    raise exception 'Senha administrativa invalida.';
  end if;

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
  order by u.nome_completo asc;
end;
$$;

grant execute on function public.usuarios_email_existe(text) to anon, authenticated;
grant execute on function public.usuarios_perfil(uuid) to anon, authenticated;
grant execute on function public.usuarios_perfil_por_email(text) to anon, authenticated;
grant execute on function public.admin_list_users(text) to anon, authenticated;
