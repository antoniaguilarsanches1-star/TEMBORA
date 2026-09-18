-- Close direct self-verification of orders; no existing data or Block 1 policies change.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='pedidos' and policyname='pedidos_crear' and cmd='INSERT')
 then raise exception 'Estado de pedidos inesperado; inspeccionar antes de continuar'; end if;
end $$;
create policy pedidos_crear_seguro on public.pedidos as restrictive for insert to authenticated
with check (
 comprador_id=(select auth.uid())
 and exists(select 1 from public.perfiles perfil where perfil.id=(select auth.uid()) and perfil.rol='comprador')
 and estado_pago='pendiente'
 and porcentaje_comision=20
 and comprobante_url is null
 and exists(select 1 from public.plantillas p
   where p.id=plantilla_id and p.estado='publicada' and p.vendedor_id=pedidos.vendedor_id
     and p.vendedor_id<>(select auth.uid()) and p.precio=pedidos.monto)
);
comment on policy pedidos_crear_seguro on public.pedidos is
'Defensa adicional: solo comprador propio, pendiente, precio y vendedor de plantilla publicada. Comisión existente 20. La verificación de pago todavía no está integrada.';
notify pgrst, 'reload schema';
