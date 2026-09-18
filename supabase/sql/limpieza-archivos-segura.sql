-- Marca primero y prohíbe volver a referenciar; elimina bytes únicamente mediante Storage API.
create table tembora_private.archivos_retirados(
 bucket text not null, ruta text not null, plantilla_id uuid not null, propietario_id uuid not null,
 marcado_at timestamptz not null default now(), primary key(bucket,ruta)
);
alter table tembora_private.archivos_retirados enable row level security;
revoke all on tembora_private.archivos_retirados from public,anon,authenticated;
create function tembora_private.archivo_no_retirado(p_bucket text,p_ruta text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from tembora_private.archivos_retirados where bucket=p_bucket and ruta=p_ruta)
$$;
revoke all on function tembora_private.archivo_no_retirado(text,text) from public,anon,authenticated;
grant execute on function tembora_private.archivo_no_retirado(text,text) to authenticated;
create policy archivos_no_reutilizar on storage.objects as restrictive for insert to authenticated
 with check(tembora_private.archivo_no_retirado(bucket_id,name));

create function tembora_private.impedir_referencia_retirada() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='plantillas' then
  if not tembora_private.archivo_no_retirado('imagenes-plantillas',new.imagen_principal)
     or not tembora_private.archivo_no_retirado('plantillas-zip',new.archivo_zip_path)
  then raise exception 'Archivo antiguo retirado. Sube una nueva versión con otro nombre.'; end if;
 else
  -- Serialize gallery references with the cleanup marker before checking tombstones.
  perform 1 from public.plantillas where id=new.plantilla_id for update;
  if not tembora_private.archivo_no_retirado('imagenes-plantillas',new.url)
  then raise exception 'Imagen antigua retirada. Sube una nueva versión.'; end if;
 end if;
 return new;
end $$;
revoke all on function tembora_private.impedir_referencia_retirada() from public,anon,authenticated;
create trigger tembora_no_referenciar_retirados before insert or update on public.plantillas
 for each row execute function tembora_private.impedir_referencia_retirada();
create trigger tembora_no_referenciar_imagen_retirada before insert or update on public.imagenes_plantilla
 for each row execute function tembora_private.impedir_referencia_retirada();

create function tembora_private.marcar_obsoletos(p_plantilla uuid)
returns table(bucket text,ruta text) language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('vendedor'); p public.plantillas;
begin
 select * into p from public.plantillas where id=p_plantilla and vendedor_id=u for update;
 if not found or not(p.estado='rechazada' or(p.estado='pendiente' and p.enviada_revision_at is null))
 then raise exception 'Solo puedes limpiar tus preparaciones y plantillas rechazadas'; end if;
 insert into tembora_private.archivos_retirados(bucket,ruta,plantilla_id,propietario_id)
 select o.bucket_id,o.name,p.id,u from storage.objects o
 where o.bucket_id in('imagenes-plantillas','plantillas-zip')
 and split_part(o.name,'/',1)=u::text and split_part(o.name,'/',2)=p.id::text
 and cardinality(string_to_array(o.name,'/'))=3 and o.created_at<now()-interval '24 hours'
 and o.name is distinct from p.imagen_principal and o.name is distinct from p.archivo_zip_path
 and not exists(select 1 from public.imagenes_plantilla i where i.plantilla_id=p.id and i.url=o.name)
 and not exists(select 1 from public.pedidos compra where compra.zip_path=o.name)
 on conflict do nothing;
 return query select r.bucket,r.ruta from tembora_private.archivos_retirados r where r.plantilla_id=p.id and r.propietario_id=u;
end $$;
create function public.tembora_marcar_obsoletos(p_plantilla uuid) returns table(bucket text,ruta text)
language sql security invoker set search_path='' as $$ select * from tembora_private.marcar_obsoletos(p_plantilla) $$;
revoke all on function tembora_private.marcar_obsoletos(uuid),public.tembora_marcar_obsoletos(uuid) from public,anon,authenticated;
grant execute on function tembora_private.marcar_obsoletos(uuid),public.tembora_marcar_obsoletos(uuid) to authenticated;
notify pgrst,'reload schema';
