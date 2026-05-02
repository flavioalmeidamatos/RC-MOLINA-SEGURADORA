drop function if exists public.admin_list_users();
drop function if exists public.admin_update_user(uuid, text, text, text, text);
drop function if exists public.admin_delete_user(uuid);

create or replace function public.admin_list_users()
returns setof "RCMOLINASEGUROS"."USUARIOS"
language plpgsql
security definer
set search_path = public, "RCMOLINASEGUROS", extensions
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'admin@rcmolina.com.br' then
    raise exception 'Acesso negado: você não tem permissão de administrador.';
  end if;

  return query
  select *
  from "RCMOLINASEGUROS"."USUARIOS"
  order by nome_completo;
end;
$$;

create or replace function public.admin_update_user(
  p_id uuid,
  p_nome text,
  p_email text,
  p_org text,
  p_avatar_url text
) returns void
language plpgsql
security definer
set search_path = public, "RCMOLINASEGUROS", extensions
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'admin@rcmolina.com.br' then
    raise exception 'Acesso negado: você não tem permissão para alterar usuários.';
  end if;

  update "RCMOLINASEGUROS"."USUARIOS"
  set nome_completo = upper(trim(p_nome)),
      email = lower(trim(p_email)),
      organizacao = nullif(trim(p_org), ''),
      avatar_url = nullif(trim(p_avatar_url), ''),
      updated_at = timezone('utc', now())
  where id = p_id;
end;
$$;

create or replace function public.admin_delete_user(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, "RCMOLINASEGUROS", extensions
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'admin@rcmolina.com.br' then
    raise exception 'Acesso negado: você não tem permissão para excluir usuários.';
  end if;

  delete from "RCMOLINASEGUROS"."USUARIOS"
  where id = p_id;
end;
$$;

revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_update_user(uuid, text, text, text, text) from public;
revoke all on function public.admin_delete_user(uuid) from public;

grant execute on function public.admin_list_users() to authenticated, service_role;
grant execute on function public.admin_update_user(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_delete_user(uuid) to authenticated, service_role;
