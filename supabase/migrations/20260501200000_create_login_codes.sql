create table if not exists public.login_codes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public."USUARIOS"(id) on delete cascade,
  email text not null,
  codigo_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists login_codes_email_idx on public.login_codes (email);
create index if not exists login_codes_usuario_idx on public.login_codes (usuario_id);
create index if not exists login_codes_active_idx on public.login_codes (email, expires_at) where used_at is null;

alter table public.login_codes enable row level security;

create or replace function public.usuarios_gerar_codigo_login(p_email text)
returns table (
  email text,
  codigo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public."USUARIOS"%rowtype;
  v_codigo text;
begin
  select *
  into v_usuario
  from public."USUARIOS" u
  where u.email = lower(trim(p_email))
  limit 1;

  if not found then
    raise exception 'E-mail nao cadastrado.';
  end if;

  v_codigo := lpad(floor(random() * 1000000)::int::text, 6, '0');

  update public.login_codes
  set used_at = now()
  where login_codes.email = v_usuario.email
    and used_at is null;

  insert into public.login_codes (
    usuario_id,
    email,
    codigo_hash,
    expires_at
  )
  values (
    v_usuario.id,
    v_usuario.email,
    extensions.crypt(v_codigo, extensions.gen_salt('bf')),
    now() + interval '10 minutes'
  );

  return query select v_usuario.email, v_codigo;
end;
$$;

create or replace function public.usuarios_verificar_codigo_login(
  p_email text,
  p_codigo text
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
  v_code public.login_codes%rowtype;
begin
  select *
  into v_code
  from public.login_codes lc
  where lc.email = lower(trim(p_email))
    and lc.used_at is null
    and lc.expires_at > now()
  order by lc.created_at desc
  limit 1;

  if not found then
    return;
  end if;

  if v_code.attempts >= 5 then
    update public.login_codes
    set used_at = now()
    where login_codes.id = v_code.id;
    return;
  end if;

  update public.login_codes
  set attempts = attempts + 1
  where login_codes.id = v_code.id;

  if v_code.codigo_hash is distinct from extensions.crypt(trim(p_codigo), v_code.codigo_hash) then
    return;
  end if;

  update public.login_codes
  set used_at = now()
  where login_codes.id = v_code.id;

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
  where u.id = v_code.usuario_id
  limit 1;
end;
$$;

grant execute on function public.usuarios_gerar_codigo_login(text) to service_role;
grant execute on function public.usuarios_verificar_codigo_login(text, text) to anon, authenticated;
