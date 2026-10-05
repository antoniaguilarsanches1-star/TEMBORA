-- Endurecimiento aplicado el 2026-10-05 al proyecto Supabase de TAVIKU.
-- Esta migración documenta los cambios ya aplicados en producción.

create or replace function public.actualizar_fecha()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','pg_temp'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop policy if exists pedidos_crear on public.pedidos;

drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles
for update to authenticated
using (((select auth.uid()) = id) or (select public.es_admin()))
with check (((select auth.uid()) = id) or (select public.es_admin()));

drop policy if exists favoritos_ver on public.favoritos;
create policy favoritos_ver on public.favoritos
for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists favoritos_crear on public.favoritos;
create policy favoritos_crear on public.favoritos
for insert to authenticated with check (usuario_id = (select auth.uid()));

drop policy if exists favoritos_eliminar on public.favoritos;
create policy favoritos_eliminar on public.favoritos
for delete to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists pedidos_ver on public.pedidos;
create policy pedidos_ver on public.pedidos
for select to authenticated
using (
  comprador_id = (select auth.uid())
  or vendedor_id = (select auth.uid())
  or (select public.es_admin())
);

drop policy if exists resenas_crear on public.resenas;
create policy resenas_crear on public.resenas
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1 from public.pedidos p
    where p.comprador_id = (select auth.uid())
      and p.plantilla_id = resenas.plantilla_id
      and p.estado_pago = 'verificado'
  )
);

drop policy if exists resenas_editar on public.resenas;
create policy resenas_editar on public.resenas
for update to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

drop policy if exists resenas_eliminar on public.resenas;
create policy resenas_eliminar on public.resenas
for delete to authenticated
using (usuario_id = (select auth.uid()) or (select public.es_admin()));

drop policy if exists retiros_ver on public.retiros;
create policy retiros_ver on public.retiros
for select to authenticated
using (vendedor_id = (select auth.uid()) or (select public.es_admin()));

drop policy if exists retiros_crear on public.retiros;
create policy retiros_crear on public.retiros
for insert to authenticated
with check (
  vendedor_id = (select auth.uid())
  and (select public.es_vendedor())
  and estado = 'pendiente'
);

drop policy if exists webs_publicadas on public.webs_completas;
drop policy if exists webs_admin_lectura on public.webs_completas;
create policy webs_publicadas_anon on public.webs_completas
for select to anon using (estado = 'publicada');
create policy webs_lectura_authenticated on public.webs_completas
for select to authenticated
using (estado = 'publicada' or (select public.es_admin()));

create index if not exists favoritos_plantilla_idx on public.favoritos(plantilla_id);
create index if not exists movimientos_actor_idx on public.movimientos_auditoria(actor_id);
create index if not exists pedidos_plantilla_idx on public.pedidos(plantilla_id);
create index if not exists pedidos_revisado_por_idx on public.pedidos(revisado_por);
create index if not exists resenas_plantilla_idx on public.resenas(plantilla_id);
create index if not exists retiros_revisado_por_idx on public.retiros(revisado_por);

drop policy if exists plantillas_ver on public.plantillas;
create policy plantillas_ver_anon on public.plantillas
for select to anon using (estado = 'publicada');
create policy plantillas_ver_authenticated on public.plantillas
for select to authenticated
using (
  estado = 'publicada'
  or (select public.es_admin())
  or (vendedor_id = (select auth.uid()) and (select public.es_vendedor()))
);

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver_anon on public.perfiles
for select to anon using (rol = 'vendedor');
create policy perfiles_ver_authenticated on public.perfiles
for select to authenticated
using (
  id = (select auth.uid())
  or rol = 'vendedor'
  or (select public.es_admin())
);

revoke truncate, trigger, references on public.pedidos from anon, authenticated;
revoke truncate, trigger, references on public.retiros from anon, authenticated;

revoke execute on function public.es_admin() from public;
revoke execute on function public.es_vendedor() from public;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_vendedor() to authenticated;
