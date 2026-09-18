-- Yape manual. RPCs invoker -> helpers privados con autorización explícita.
-- No cambia usuarios ni las protecciones de plantillas del Bloque 1.
do $$ begin
 if exists(select 1 from public.pedidos) or exists(select 1 from public.retiros)
 then raise exception 'Existen movimientos: inspeccionar y migrar sin modificar datos antes de aplicar'; end if;
end $$;

create table public.configuracion_pagos (
 id boolean primary key default true check(id), yape_numero text, yape_titular text,
 activo boolean not null default false,
 check(not activo or (yape_numero ~ '^9[0-9]{8}$' and length(btrim(yape_titular))>=3))
);
insert into public.configuracion_pagos(id) values(true);
alter table public.configuracion_pagos enable row level security;
revoke all on public.configuracion_pagos from public,anon,authenticated;
grant select on public.configuracion_pagos to authenticated;
create policy pagos_config_ver on public.configuracion_pagos for select to authenticated using(true);

alter table public.pedidos
 add column plantilla_nombre text not null,
 add column zip_path text not null,
 add column yape_numero text not null,
 add column yape_titular text not null,
 add column enviada_pago_at timestamptz,
 add column revisado_at timestamptz,
 add column revisado_por uuid references public.perfiles(id),
 add column motivo_rechazo text,
 add column operacion_yape text,
 add column comision_plataforma numeric(12,2) generated always as (round(monto*0.20,2)) stored,
 add column ingreso_vendedor numeric(12,2) generated always as (monto-round(monto*0.20,2)) stored,
 add constraint pedido_comision_fija check(porcentaje_comision=20),
 add constraint pedido_importe_valido check(monto>=20 and monto=round(monto,2)),
 add constraint pedido_unico unique(comprador_id,plantilla_id);
create unique index pedido_operacion_yape_unica on public.pedidos(operacion_yape) where estado_pago='verificado';
create index pedidos_vendedor_pago on public.pedidos(vendedor_id,estado_pago);
alter table public.retiros
 add column destino_numero text not null,
 add column destino_titular text not null,
 add column revisado_por uuid references public.perfiles(id),
 add column revisado_at timestamptz,
 add column motivo_rechazo text,
 add column referencia_pago text,
 add column pagado_at timestamptz,
 add column solicitud_id uuid not null unique,
 add constraint retiro_importe_valido check(monto>=50 and monto=round(monto,2));
create unique index retiros_referencia_unica on public.retiros(referencia_pago) where estado='pagado';
create index retiros_vendedor_estado on public.retiros(vendedor_id,estado);

create table public.movimientos_auditoria (
 id bigint generated always as identity primary key, entidad text not null, entidad_id uuid not null,
 actor_id uuid not null references public.perfiles(id), propietario_id uuid not null references public.perfiles(id),
 accion text not null, detalle text, created_at timestamptz not null default now()
);
alter table public.movimientos_auditoria enable row level security;
revoke all on public.movimientos_auditoria from public,anon,authenticated;
grant select on public.movimientos_auditoria to authenticated;
create policy movimientos_ver on public.movimientos_auditoria for select to authenticated
 using(propietario_id=(select auth.uid()) or (select public.es_admin()));
create index movimientos_propietario on public.movimientos_auditoria(propietario_id,created_at);

-- Solo funciones autorizadas escriben movimientos. RLS continúa activado para lectura.
revoke insert,update,delete on public.pedidos,public.retiros from public,anon,authenticated;
grant select on public.pedidos,public.retiros to authenticated;

create function tembora_private.exigir_rol(p_rol text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r text;
begin
 select rol into r from public.perfiles where id=u;
 if u is null or r is distinct from p_rol then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 return u;
end $$;

create function tembora_private.configurar_yape(p_numero text,p_titular text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform tembora_private.exigir_rol('admin');
 if p_numero is null or p_numero !~ '^9[0-9]{8}$' or length(btrim(coalesce(p_titular,'')))<3
 then raise exception 'Número o titular no válido'; end if;
 update public.configuracion_pagos set yape_numero=p_numero,yape_titular=btrim(p_titular),activo=true where id;
end $$;

create function tembora_private.crear_pedido(p_plantilla uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('comprador'); p public.plantillas; c public.configuracion_pagos; pid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_plantilla::text,0));
 select id into pid from public.pedidos where comprador_id=u and plantilla_id=p_plantilla;
 if found then return pid; end if;
 select * into c from public.configuracion_pagos where id and activo;
 if not found then raise exception 'Yape aún no está configurado. No realices pagos.'; end if;
 select * into p from public.plantillas where id=p_plantilla and estado='publicada' for share;
 if not found or p.vendedor_id=u or p.archivo_zip_path is null then raise exception 'Plantilla no disponible'; end if;
 insert into public.pedidos(comprador_id,vendedor_id,plantilla_id,monto,porcentaje_comision,estado_pago,
 plantilla_nombre,zip_path,yape_numero,yape_titular)
 values(u,p.vendedor_id,p.id,p.precio,20,'pendiente',p.nombre,p.archivo_zip_path,c.yape_numero,c.yape_titular) returning id into pid;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion)
 values('pedido',pid,u,u,'creado');
 return pid;
end $$;

create function tembora_private.comprobante_permitido(p_name text,p_escritura boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare p public.pedidos; pid uuid; u uuid:=auth.uid();
begin
 if u is null or cardinality(string_to_array(p_name,'/'))<>3 then return false; end if;
 begin pid:=split_part(p_name,'/',2)::uuid; exception when invalid_text_representation then return false; end;
 if split_part(p_name,'/',3) !~ '^[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$' then return false; end if;
 select * into p from public.pedidos where id=pid for update;
 if not found or split_part(p_name,'/',1)<>p.comprador_id::text then return false; end if;
 if not p_escritura then return u=p.comprador_id or public.es_admin(); end if;
 return u=p.comprador_id and (p.estado_pago='rechazado' or (p.estado_pago='pendiente' and p.enviada_pago_at is null));
end $$;

create function tembora_private.enviar_comprobante(p_pedido uuid,p_ruta text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('comprador'); p public.pedidos;
begin
 select * into p from public.pedidos where id=p_pedido and comprador_id=u for update;
 if not found then raise exception 'Pedido no disponible'; end if;
 if p.comprobante_url=p_ruta and p.enviada_pago_at is not null then return; end if;
 if p_ruta is null or not tembora_private.comprobante_permitido(p_ruta,true)
 or split_part(p_ruta,'/',2)<>p.id::text
 or not exists(select 1 from storage.objects where bucket_id='comprobantes' and name=p_ruta)
 then raise exception 'Comprobante no disponible o pedido bloqueado'; end if;
 update public.pedidos set comprobante_url=p_ruta,estado_pago='pendiente',enviada_pago_at=now(),
 revisado_at=null,revisado_por=null,motivo_rechazo=null where id=p.id;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion,detalle)
 values('pedido',p.id,u,u,'comprobante_enviado',p_ruta);
end $$;

create function tembora_private.revisar_pago(p_pedido uuid,p_aprobar boolean,p_referencia text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('admin'); p public.pedidos; ref text:=upper(btrim(p_referencia));
begin
 select * into p from public.pedidos where id=p_pedido for update;
 if not found or u in(p.comprador_id,p.vendedor_id) then raise exception 'Pedido no revisable'; end if;
 if p_aprobar is null or length(coalesce(ref,''))<3 then raise exception 'Indica operación Yape real o motivo de rechazo'; end if;
 if p.estado_pago='verificado' and p_aprobar and p.operacion_yape=ref then return; end if;
 if p.estado_pago<>'pendiente' or p.enviada_pago_at is null or not exists(
 select 1 from storage.objects where bucket_id='comprobantes' and name=p.comprobante_url)
 then raise exception 'No hay un comprobante pendiente de revisión'; end if;
 update public.pedidos set estado_pago=case when p_aprobar then 'verificado' else 'rechazado' end,
 operacion_yape=case when p_aprobar then ref else null end,
 motivo_rechazo=case when p_aprobar then null else btrim(p_referencia) end,revisado_at=now(),revisado_por=u where id=p.id;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion,detalle)
 values('pedido',p.id,u,p.comprador_id,case when p_aprobar then 'pago_verificado' else 'pago_rechazado' end,ref);
end $$;

create function tembora_private.zip_comprado(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_bucket='plantillas-zip' and exists(
 select 1 from public.pedidos p where p.comprador_id=auth.uid() and p.estado_pago='verificado'
 and p.revisado_por is not null and p.zip_path=p_path)
$$;
create policy zip_compra_verificada on storage.objects for select to authenticated
 using(tembora_private.zip_comprado(bucket_id,name));

-- Comprobantes inmutables; el comprador no puede sustituir un archivo ya enviado.
drop policy "usuario sube su comprobante" on storage.objects;
drop policy "usuario ve su comprobante" on storage.objects;
drop policy "usuario elimina su comprobante" on storage.objects;
create policy comprobantes_subir on storage.objects for insert to authenticated
 with check(bucket_id='comprobantes' and tembora_private.comprobante_permitido(name,true));
create policy comprobantes_ver on storage.objects for select to authenticated
 using(bucket_id='comprobantes' and tembora_private.comprobante_permitido(name,false));
create policy comprobantes_no_reemplazar on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'comprobantes') with check(bucket_id<>'comprobantes');
-- No DELETE: la evidencia se conserva para auditoría; solo archivos de plantilla tienen limpieza.

create function tembora_private.saldo(p_vendedor uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce((select sum(ingreso_vendedor) from public.pedidos where vendedor_id=p_vendedor and estado_pago='verificado'),0)
 - coalesce((select sum(monto) from public.retiros where vendedor_id=p_vendedor and estado in('pendiente','aprobado','pagado')),0)
$$;
create function tembora_private.solicitar_retiro(p_solicitud uuid,p_monto numeric,p_numero text,p_titular text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('vendedor'); rid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('saldo:'||u::text,0));
 select id into rid from public.retiros where solicitud_id=p_solicitud and vendedor_id=u;
 if found then return rid; end if;
 if p_solicitud is null or p_monto is null or p_monto<50 or p_monto<>round(p_monto,2) or p_monto='NaN'::numeric
 or p_numero is null or p_numero !~ '^9[0-9]{8}$' or length(btrim(coalesce(p_titular,'')))<3
 then raise exception 'Retiro no válido. Mínimo S/50 y destino Yape completo.'; end if;
 if p_monto>tembora_private.saldo(u) then raise exception 'Saldo disponible insuficiente'; end if;
 insert into public.retiros(vendedor_id,monto,metodo,estado,destino_numero,destino_titular,solicitud_id)
 values(u,p_monto,'yape','pendiente',p_numero,btrim(p_titular),p_solicitud) returning id into rid;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion)
 values('retiro',rid,u,u,'solicitado');
 return rid;
end $$;
create function tembora_private.revisar_retiro(p_retiro uuid,p_estado text,p_referencia text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('admin'); r public.retiros;
begin
 select * into r from public.retiros where id=p_retiro;
 if not found or r.vendedor_id=u then raise exception 'Retiro no disponible'; end if;
 perform pg_advisory_xact_lock(hashtextextended('saldo:'||r.vendedor_id::text,0));
 select * into r from public.retiros where id=p_retiro for update;
 if p_estado is null or p_estado not in('aprobado','rechazado','pagado') then raise exception 'Estado no válido'; end if;
 if r.estado=p_estado then return; end if;
 if not ((r.estado='pendiente' and p_estado in('aprobado','rechazado')) or (r.estado='aprobado' and p_estado in('pagado','rechazado')))
 then raise exception 'Transición no permitida'; end if;
 if p_estado in('rechazado','pagado') and length(btrim(coalesce(p_referencia,'')))<3 then raise exception 'Indica motivo o referencia de la transferencia real'; end if;
 update public.retiros set estado=p_estado,revisado_por=u,revisado_at=now(),
 motivo_rechazo=case when p_estado='rechazado' then btrim(p_referencia) else null end,
 referencia_pago=case when p_estado='pagado' then upper(btrim(p_referencia)) else null end,
 pagado_at=case when p_estado='pagado' then now() else null end where id=r.id;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion,detalle)
 values('retiro',r.id,u,r.vendedor_id,p_estado,p_referencia);
end $$;

-- Wrappers públicos sin privilegios elevados. Los helpers privados validan siempre auth.uid/rol.
create function public.tembora_configurar_yape(p_numero text,p_titular text) returns void language sql security invoker set search_path='' as $$select tembora_private.configurar_yape(p_numero,p_titular)$$;
create function public.tembora_crear_pedido(p_plantilla uuid) returns uuid language sql security invoker set search_path='' as $$select tembora_private.crear_pedido(p_plantilla)$$;
create function public.tembora_enviar_comprobante(p_pedido uuid,p_ruta text) returns void language sql security invoker set search_path='' as $$select tembora_private.enviar_comprobante(p_pedido,p_ruta)$$;
create function public.tembora_revisar_pago(p_pedido uuid,p_aprobar boolean,p_referencia text) returns void language sql security invoker set search_path='' as $$select tembora_private.revisar_pago(p_pedido,p_aprobar,p_referencia)$$;
create function public.tembora_solicitar_retiro(p_solicitud uuid,p_monto numeric,p_numero text,p_titular text) returns uuid language sql security invoker set search_path='' as $$select tembora_private.solicitar_retiro(p_solicitud,p_monto,p_numero,p_titular)$$;
create function public.tembora_revisar_retiro(p_retiro uuid,p_estado text,p_referencia text) returns void language sql security invoker set search_path='' as $$select tembora_private.revisar_retiro(p_retiro,p_estado,p_referencia)$$;

revoke all on function tembora_private.saldo(uuid),tembora_private.exigir_rol(text) from public,anon,authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='tembora_private' and p.proname in('configurar_yape','crear_pedido','comprobante_permitido','enviar_comprobante','revisar_pago','zip_comprado','solicitar_retiro','revisar_retiro'))
 or (n.nspname='public' and p.proname in('tembora_configurar_yape','tembora_crear_pedido','tembora_enviar_comprobante','tembora_revisar_pago','tembora_solicitar_retiro','tembora_revisar_retiro'))
 loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 execute format('grant execute on function %s to authenticated',f.sig); end loop;
end $$;
notify pgrst,'reload schema';
