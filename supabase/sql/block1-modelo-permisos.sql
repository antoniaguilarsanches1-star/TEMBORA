-- TEMBORA Fase 2 / Bloque 1. No frontend, Auth or profile-role changes.
do $$ begin
 if exists(select 1 from public.plantillas) or exists(select 1 from public.imagenes_plantilla)
 or exists(select 1 from storage.objects where bucket_id in ('imagenes-plantillas','plantillas-zip'))
 then raise exception 'El estado cambio desde la inspeccion; volver a revisar antes de aplicar'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.plantillas'::regclass and tgname='proteger_estado' and tgenabled='O')
 then raise exception 'Falta el trigger de proteccion esperado'; end if;
end $$;
-- An initial pending row is editable until enviada_revision_at is set.
-- Existing target tables and Storage are empty (verified before deployment).
create schema if not exists tembora_private;
revoke all on schema tembora_private from public, anon, authenticated;
grant usage on schema tembora_private to anon, authenticated;

alter table public.plantillas
  add column enviada_revision_at timestamptz,
  add column revisada_at timestamptz,
  add column revisada_por uuid references public.perfiles(id),
  add column motivo_rechazo text;
alter table public.plantillas alter column estado set default 'pendiente';
alter table public.plantillas add constraint plantillas_rutas_propias check (
  (archivo_zip_path is null or (
    split_part(archivo_zip_path,'/',1)=vendedor_id::text and
    split_part(archivo_zip_path,'/',2)=id::text and
    cardinality(string_to_array(archivo_zip_path,'/'))=3 and
    split_part(archivo_zip_path,'/',3) ~ '^[A-Za-z0-9_-]+[.]zip$'))
  and (imagen_principal is null or (
    split_part(imagen_principal,'/',1)=vendedor_id::text and
    split_part(imagen_principal,'/',2)=id::text and
    cardinality(string_to_array(imagen_principal,'/'))=3 and
    split_part(imagen_principal,'/',3) ~ '^[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$'))
);
alter table public.imagenes_plantilla add constraint imagenes_orden_no_negativo check (orden >= 0);
create index plantillas_vendedor_estado_idx on public.plantillas(vendedor_id,estado);
create index plantillas_revision_idx on public.plantillas(estado,enviada_revision_at);
create index plantillas_categoria_idx on public.plantillas(categoria_id);
create index plantillas_revisor_idx on public.plantillas(revisada_por);
create index imagenes_plantilla_padre_idx on public.imagenes_plantilla(plantilla_id);

-- Locked ownership check serializes asset changes with submission/review.
-- Private schema, fixed search_path, no metadata/JWT role authority.
create function tembora_private.puede_editar_archivos(p_plantilla uuid)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare p public.plantillas;
begin
  if auth.uid() is null or not public.es_vendedor() then return false; end if;
  select * into p from public.plantillas where id=p_plantilla for update;
  if not found then return false; end if;
  return p.vendedor_id=auth.uid() and
    (p.estado='rechazada' or (p.estado='pendiente' and p.enviada_revision_at is null));
end;
$$;

create function tembora_private.archivo_editable(p_bucket text,p_name text)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare p public.plantillas; pid uuid;
begin
  if auth.uid() is null or p_bucket not in ('imagenes-plantillas','plantillas-zip') then return false; end if;
  if cardinality(string_to_array(p_name,'/'))<>3
     or split_part(p_name,'/',1)<>auth.uid()::text then return false; end if;
  begin pid := split_part(p_name,'/',2)::uuid;
  exception when invalid_text_representation then return false; end;
  if p_bucket='plantillas-zip' and split_part(p_name,'/',3) !~ '^[A-Za-z0-9_-]+[.]zip$' then return false; end if;
  if p_bucket='imagenes-plantillas' and split_part(p_name,'/',3) !~ '^[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$' then return false; end if;
  return tembora_private.puede_editar_archivos(pid);
end;
$$;

create function tembora_private.archivo_visible(p_bucket text,p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
select exists (
 select 1 from public.plantillas p
 where p.vendedor_id::text=split_part(p_name,'/',1)
   and p.id::text=split_part(p_name,'/',2)
   and cardinality(string_to_array(p_name,'/'))=3
   and p_bucket in ('imagenes-plantillas','plantillas-zip')
   and (
     (auth.uid() is not null and (public.es_admin() or (p.vendedor_id=auth.uid() and public.es_vendedor())))
     or (p_bucket='imagenes-plantillas' and p.estado='publicada'
       and (p.imagen_principal=p_name or exists (
         select 1 from public.imagenes_plantilla i where i.plantilla_id=p.id and i.url=p_name)))
   )
);
$$;
revoke all on function tembora_private.puede_editar_archivos(uuid),
 tembora_private.archivo_editable(text,text),tembora_private.archivo_visible(text,text) from public,anon,authenticated;
grant execute on function tembora_private.puede_editar_archivos(uuid),
 tembora_private.archivo_editable(text,text) to authenticated;
grant execute on function tembora_private.archivo_visible(text,text) to anon,authenticated;

-- Replace the existing state guard; preserve its existing trigger binding.
create or replace function public.proteger_estado_plantilla()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare actor uuid:=auth.uid(); es_admin boolean:=public.es_admin(); enviar boolean:=false;
begin
 if actor is null then raise exception 'Sesion requerida' using errcode='42501'; end if;
 if TG_OP='DELETE' then
   if old.vendedor_id<>actor or not public.es_vendedor()
      or not (old.estado='rechazada' or (old.estado='pendiente' and old.enviada_revision_at is null))
   then raise exception 'Solo puedes eliminar tus plantillas en preparacion o rechazadas' using errcode='42501'; end if;
   if exists(select 1 from storage.objects o where o.bucket_id in ('imagenes-plantillas','plantillas-zip')
      and split_part(o.name,'/',1)=old.vendedor_id::text and split_part(o.name,'/',2)=old.id::text)
   then raise exception 'Elimina primero los archivos mediante Storage' using errcode='23514'; end if;
   return old;
 end if;
 if TG_OP='INSERT' then
   if new.vendedor_id<>actor or not public.es_vendedor() then raise exception 'Propietario no permitido' using errcode='42501'; end if;
   new.estado:='pendiente'; new.enviada_revision_at:=null;
   new.revisada_at:=null; new.revisada_por:=null; new.motivo_rechazo:=null;
   new.ventas:=0; new.calificacion:=0; new.created_at:=now(); new.updated_at:=now();
   return new;
 end if;
 if new.id is distinct from old.id or new.vendedor_id is distinct from old.vendedor_id
    or new.created_at is distinct from old.created_at
    or new.ventas is distinct from old.ventas or new.calificacion is distinct from old.calificacion
 then raise exception 'Identidad, propietario y metricas no son editables' using errcode='42501'; end if;
 if es_admin and actor<>old.vendedor_id then
   if old.estado<>'pendiente' or old.enviada_revision_at is null
      or new.estado not in ('publicada','rechazada')
   then raise exception 'Solo se revisan envios pendientes' using errcode='42501'; end if;
   if (to_jsonb(new)-array['estado','revisada_at','revisada_por','motivo_rechazo','updated_at'])
      is distinct from (to_jsonb(old)-array['estado','revisada_at','revisada_por','motivo_rechazo','updated_at'])
   then raise exception 'La revision no puede modificar el contenido enviado' using errcode='42501'; end if;
   if new.estado='rechazada' and nullif(btrim(new.motivo_rechazo),'') is null
   then raise exception 'Indica el motivo del rechazo' using errcode='23514'; end if;
   new.revisada_por:=actor; new.revisada_at:=now();
   if new.estado='publicada' then new.motivo_rechazo:=null; end if;
 else
   if actor<>old.vendedor_id or not public.es_vendedor()
     or not (old.estado='rechazada' or (old.estado='pendiente' and old.enviada_revision_at is null))
   then raise exception 'Plantilla bloqueada para revision o ya publicada' using errcode='42501'; end if;
   enviar:=new.estado='pendiente' and new.enviada_revision_at is not null
      and (old.estado='rechazada' or old.enviada_revision_at is null);
   if not enviar then
     if new.estado is distinct from old.estado or new.enviada_revision_at is distinct from old.enviada_revision_at
       or new.revisada_por is distinct from old.revisada_por or new.revisada_at is distinct from old.revisada_at
       or new.motivo_rechazo is distinct from old.motivo_rechazo
     then raise exception 'No puedes cambiar el estado ni la revision' using errcode='42501'; end if;
   else
     if new.categoria_id is null or nullif(btrim(new.nombre),'') is null
       or nullif(btrim(new.descripcion),'') is null or new.archivo_zip_path is null or new.imagen_principal is null
     then raise exception 'Completa informacion, imagen y ZIP antes de enviar' using errcode='23514'; end if;
     if not exists(select 1 from storage.objects where bucket_id='plantillas-zip' and name=new.archivo_zip_path)
       or not exists(select 1 from storage.objects where bucket_id='imagenes-plantillas' and name=new.imagen_principal)
       or exists(select 1 from public.imagenes_plantilla i where i.plantilla_id=new.id and not exists(
          select 1 from storage.objects o where o.bucket_id='imagenes-plantillas' and o.name=i.url))
     then raise exception 'Faltan archivos en Storage' using errcode='23514'; end if;
     new.enviada_revision_at:=clock_timestamp(); new.revisada_at:=null; new.revisada_por:=null; new.motivo_rechazo:=null;
   end if;
 end if;
 new.updated_at:=now();
 return new;
end;
$$;
create trigger tembora_plantilla_eliminar before delete on public.plantillas
 for each row execute function public.proteger_estado_plantilla();
revoke all on function public.proteger_estado_plantilla() from public,anon,authenticated;

create function tembora_private.proteger_imagen()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare propietario uuid;
begin
 if TG_OP='UPDATE' and (new.id is distinct from old.id or new.plantilla_id is distinct from old.plantilla_id
   or new.created_at is distinct from old.created_at)
 then raise exception 'No puedes reasignar una imagen' using errcode='42501'; end if;
 select vendedor_id into propietario from public.plantillas where id=new.plantilla_id;
 if propietario is null then raise exception 'Plantilla no disponible' using errcode='42501'; end if;
 if split_part(new.url,'/',1)<>propietario::text
   or split_part(new.url,'/',2)<>new.plantilla_id::text
   or cardinality(string_to_array(new.url,'/'))<>3
   or split_part(new.url,'/',3) !~ '^[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$'
 then raise exception 'Ruta de imagen no valida para esta plantilla' using errcode='23514'; end if;
 return new;
end;
$$;
revoke all on function tembora_private.proteger_imagen() from public,anon,authenticated;
create trigger tembora_imagen_proteger before insert or update on public.imagenes_plantilla
 for each row execute function tembora_private.proteger_imagen();

-- Public, RLS-respecting APIs for the next block; no UI connected now.
create function public.tembora_enviar_plantilla(p_plantilla uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
 update public.plantillas set estado='pendiente',enviada_revision_at=clock_timestamp(),
   revisada_at=null,revisada_por=null,motivo_rechazo=null
 where id=p_plantilla and vendedor_id=auth.uid();
 if not found then raise exception 'Plantilla no disponible' using errcode='42501'; end if;
end;
$$;
create function public.tembora_revisar_plantilla(p_plantilla uuid,p_estado text,p_motivo text default null)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
 if auth.uid() is null or not public.es_admin() or p_estado is null or p_estado not in ('publicada','rechazada')
 then raise exception 'Revision no autorizada' using errcode='42501'; end if;
 update public.plantillas set estado=p_estado,motivo_rechazo=p_motivo
 where id=p_plantilla and vendedor_id<>auth.uid();
 if not found then raise exception 'Plantilla no disponible o propia' using errcode='42501'; end if;
end;
$$;
revoke all on function public.tembora_enviar_plantilla(uuid),public.tembora_revisar_plantilla(uuid,text,text) from public,anon,authenticated;
grant execute on function public.tembora_enviar_plantilla(uuid),public.tembora_revisar_plantilla(uuid,text,text) to authenticated;

revoke all on public.plantillas,public.imagenes_plantilla,public.categorias from public,anon,authenticated;
grant select on public.plantillas,public.imagenes_plantilla,public.categorias to anon,authenticated;
grant insert,update,delete on public.plantillas,public.imagenes_plantilla to authenticated;
alter table public.plantillas enable row level security;
alter table public.imagenes_plantilla enable row level security;
alter table public.categorias enable row level security;

drop policy plantillas_crear on public.plantillas;
drop policy plantillas_editar on public.plantillas;
drop policy plantillas_eliminar on public.plantillas;
drop policy plantillas_ver on public.plantillas;
create policy plantillas_crear on public.plantillas for insert to authenticated
 with check (vendedor_id=(select auth.uid()) and (select public.es_vendedor()) and estado='pendiente' and enviada_revision_at is null);
create policy plantillas_ver on public.plantillas for select to anon,authenticated
 using (estado='publicada' or (select public.es_admin()) or (vendedor_id=(select auth.uid()) and (select public.es_vendedor())));
create policy plantillas_editar on public.plantillas for update to authenticated
 using ((select public.es_admin()) or (vendedor_id=(select auth.uid()) and (select public.es_vendedor())
   and (estado='rechazada' or (estado='pendiente' and enviada_revision_at is null))))
 with check ((select public.es_admin()) or (vendedor_id=(select auth.uid()) and (select public.es_vendedor()) and estado in ('pendiente','rechazada')));
create policy plantillas_eliminar on public.plantillas for delete to authenticated
 using (vendedor_id=(select auth.uid()) and (select public.es_vendedor()) and
   (estado='rechazada' or (estado='pendiente' and enviada_revision_at is null)));

drop policy imagenes_crear on public.imagenes_plantilla;
drop policy imagenes_ver on public.imagenes_plantilla;
create policy imagenes_crear on public.imagenes_plantilla for insert to authenticated
 with check (tembora_private.puede_editar_archivos(plantilla_id));
create policy imagenes_editar on public.imagenes_plantilla for update to authenticated
 using (tembora_private.puede_editar_archivos(plantilla_id))
 with check (tembora_private.puede_editar_archivos(plantilla_id));
create policy imagenes_eliminar on public.imagenes_plantilla for delete to authenticated
 using (tembora_private.puede_editar_archivos(plantilla_id));
create policy imagenes_ver on public.imagenes_plantilla for select to anon,authenticated
 using (exists(select 1 from public.plantillas p where p.id=plantilla_id));
-- categorias_ver remains read-only; no category write capability is added.

-- Remove only template-image access from the shared avatar policies.
alter policy "usuarios suben imagenes propias" on storage.objects
 with check (bucket_id='avatares' and (storage.foldername(name))[1]=(select auth.uid())::text);
alter policy "usuarios actualizan imagenes propias" on storage.objects
 using (bucket_id='avatares' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.es_admin())))
 with check (bucket_id='avatares' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.es_admin())));
alter policy "usuarios eliminan imagenes propias" on storage.objects
 using (bucket_id='avatares' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.es_admin())));
drop policy "vendedor actualiza sus zip" on storage.objects;
drop policy "vendedor elimina sus zip" on storage.objects;
drop policy "vendedor sube sus plantillas zip" on storage.objects;
drop policy "vendedor ve sus propios zip" on storage.objects;
create policy tembora_archivos_ver on storage.objects for select to anon,authenticated
 using (tembora_private.archivo_visible(bucket_id,name));
create policy tembora_archivos_crear on storage.objects for insert to authenticated
 with check (tembora_private.archivo_editable(bucket_id,name));
create policy tembora_archivos_eliminar on storage.objects for delete to authenticated
 using (tembora_private.archivo_editable(bucket_id,name));
-- No UPDATE/upsert/rename for template assets, including moves to other buckets.
create policy tembora_archivos_sin_reemplazo on storage.objects as restrictive for update to authenticated
 using (bucket_id not in ('imagenes-plantillas','plantillas-zip'))
 with check (bucket_id not in ('imagenes-plantillas','plantillas-zip'));
-- Config-only change, no object metadata or underlying files are modified.
update storage.buckets set public=false where id in ('imagenes-plantillas','plantillas-zip');
comment on column public.plantillas.enviada_revision_at is 'NULL: pendiente en preparacion. No NULL y estado pendiente: enviado y bloqueado para revision.';
comment on column public.imagenes_plantilla.url is 'Ruta relativa en imagenes-plantillas: vendedor UUID / plantilla UUID / archivo. No URL publica ni firmada.';
comment on column public.plantillas.imagen_principal is 'Ruta relativa en el bucket privado imagenes-plantillas; lectura anonima solo si publicada.';
notify pgrst, 'reload schema';
