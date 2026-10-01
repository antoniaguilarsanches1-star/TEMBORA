-- Solo retiros: conserva RLS, permisos, comisión, saldo y revisión administrativa.
-- Un retiro aprobado sigue reservado hasta que se pague o rechace.
create unique index if not exists retiros_uno_activo_por_vendedor
on public.retiros(vendedor_id) where estado in ('pendiente','aprobado');

create or replace function tembora_private.solicitar_retiro(
 p_solicitud uuid,p_monto numeric,p_numero text,p_titular text
) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('vendedor'); rid uuid; disponible numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended('saldo:'||u::text,0));
 select id into rid from public.retiros where solicitud_id=p_solicitud and vendedor_id=u;
 if found then return rid; end if;
 if p_solicitud is null or p_numero is null or p_numero !~ '^[0-9]{9}$'
 or length(btrim(coalesce(p_titular,'')))<2 or p_titular !~ '^[[:alpha:] ]+$'
 then raise exception 'Indica un Yape de 9 dígitos y un titular de al menos 2 caracteres, solo letras y espacios.'; end if;
 if exists(select 1 from public.retiros where vendedor_id=u and estado in('pendiente','aprobado'))
 then raise exception 'Ya tienes un retiro pendiente de resolución.'; end if;
 disponible:=tembora_private.saldo(u);
 if disponible<50 then raise exception 'El saldo disponible debe alcanzar S/50.'; end if;
 -- El monto recibido es únicamente la cifra que el vendedor confirmó.
 -- Si cambió el saldo, exigir una nueva confirmación; nunca cobrar otra cifra.
 if p_monto is null or p_monto<>disponible or p_monto='NaN'::numeric
 then raise exception 'El saldo cambió. Actualiza y confirma el monto completo.'; end if;
 insert into public.retiros(vendedor_id,monto,metodo,estado,destino_numero,destino_titular,solicitud_id)
 values(u,disponible,'yape','pendiente',p_numero,btrim(p_titular),p_solicitud) returning id into rid;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion)
 values('retiro',rid,u,u,'solicitado');
 return rid;
end $$;
