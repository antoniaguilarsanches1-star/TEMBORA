-- Pago o rechazo directo; conserva autorización, bloqueos, permisos y auditoría.
-- Acepta retiros aprobados antiguos, pero no crea nuevos estados intermedios.
create or replace function tembora_private.revisar_retiro(p_retiro uuid,p_estado text,p_referencia text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=tembora_private.exigir_rol('admin'); r public.retiros;
begin
 select * into r from public.retiros where id=p_retiro;
 if not found or r.vendedor_id=u then raise exception 'Retiro no disponible'; end if;
 perform pg_advisory_xact_lock(hashtextextended('saldo:'||r.vendedor_id::text,0));
 select * into r from public.retiros where id=p_retiro for update;
 if p_estado is null or p_estado not in('rechazado','pagado') then raise exception 'Estado no válido'; end if;
 if r.estado=p_estado then return; end if;
 if not (r.estado in('pendiente','aprobado') and p_estado in('pagado','rechazado'))
 then raise exception 'Transición no permitida'; end if;
 if p_estado in('rechazado','pagado') and length(btrim(coalesce(p_referencia,'')))<3 then raise exception 'Indica motivo o referencia de la transferencia real'; end if;
 update public.retiros set estado=p_estado,revisado_por=u,revisado_at=now(),
 motivo_rechazo=case when p_estado='rechazado' then btrim(p_referencia) else null end,
 referencia_pago=case when p_estado='pagado' then upper(btrim(p_referencia)) else null end,
 pagado_at=case when p_estado='pagado' then now() else null end where id=r.id;
 insert into public.movimientos_auditoria(entidad,entidad_id,actor_id,propietario_id,accion,detalle)
 values('retiro',r.id,u,r.vendedor_id,p_estado,p_referencia);
end $$;

