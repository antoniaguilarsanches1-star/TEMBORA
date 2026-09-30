-- No modifica RLS ni roles existentes. El alta social espera una elección explícita.
create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog','public','pg_temp' as $$
declare rol_elegido text;
begin
  if new.raw_app_meta_data->>'provider' in ('google','facebook') then
    return new;
  end if;
  rol_elegido := coalesce(new.raw_user_meta_data->>'rol','comprador');
  if rol_elegido not in ('comprador','vendedor') then rol_elegido := 'comprador'; end if;
  insert into public.perfiles(id,nombre_completo,rol)
  values(new.id,coalesce(new.raw_user_meta_data->>'nombre_completo',''),rol_elegido);
  return new;
end $$;

create or replace function tembora_private.elegir_rol_social(p_rol text)
returns text language plpgsql security definer set search_path = '' as $$
declare usuario auth.users%rowtype; actual text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para elegir tu rol.'; end if;
  if p_rol is null or p_rol not in ('comprador','vendedor') then
    raise exception 'Solo puedes elegir comprador o vendedor.';
  end if;
  select * into usuario from auth.users where id=auth.uid() for update;
  if not found then raise exception 'Usuario no válido.'; end if;
  select rol into actual from public.perfiles where id=usuario.id;
  if found then return actual; end if;
  if coalesce(usuario.raw_app_meta_data->>'provider','') not in ('google','facebook') then
    raise exception 'Esta cuenta no tiene un alta social pendiente.';
  end if;
  insert into public.perfiles(id,nombre_completo,rol)
  values(usuario.id,left(coalesce(usuario.raw_user_meta_data->>'nombre_completo',
    usuario.raw_user_meta_data->>'full_name',usuario.raw_user_meta_data->>'name',''),120),p_rol)
  on conflict (id) do nothing;
  select rol into actual from public.perfiles where id=usuario.id;
  return actual;
end $$;
revoke all on function tembora_private.elegir_rol_social(text) from public,anon;
grant execute on function tembora_private.elegir_rol_social(text) to authenticated;
create or replace function public.tembora_elegir_rol_social(p_rol text)
returns text language sql security invoker set search_path='' as $$
  select tembora_private.elegir_rol_social(p_rol);
$$;
revoke all on function public.tembora_elegir_rol_social(text) from public,anon;
grant execute on function public.tembora_elegir_rol_social(text) to authenticated;
