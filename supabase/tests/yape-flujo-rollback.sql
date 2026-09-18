-- Pruebas transaccionales: identidades sintéticas sin correo ni contraseña.
-- Los objetos Storage son fixtures de metadatos, NO subidas físicas.
-- ROLLBACK elimina absolutamente todos los fixtures; no toca cuentas reales.
begin;
do $$
declare s uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 t uuid:=gen_random_uuid(); o uuid; r uuid; r2 uuid; root text; receipt text; blocked boolean;
begin
 insert into auth.users(id,raw_user_meta_data) values
 (s,'{"rol":"vendedor","nombre_completo":"TEMP_TEST_SELLER"}'),
 (b,'{"rol":"comprador","nombre_completo":"TEMP_TEST_BUYER"}'),
 (a,'{"rol":"comprador","nombre_completo":"TEMP_TEST_ADMIN"}'),
 (stranger,'{"rol":"comprador","nombre_completo":"TEMP_TEST_OTHER"}');
 update public.perfiles set rol='admin' where id=a; -- solo fixture generado en esta transacción
 perform set_config('request.jwt.claim.sub',s::text,true);
 perform set_config('role','authenticated',true);
 insert into public.plantillas(id,vendedor_id,categoria_id,nombre,descripcion,precio,tecnologias)
 values(t,s,(select min(id) from public.categorias),'TEMP_TEST_YAPE',repeat('x',100),100,array['HTML']);
 perform set_config('role','none',true);
 root:=s::text||'/'||t::text;
 insert into storage.objects(bucket_id,name) values('imagenes-plantillas',root||'/principal.png'),('plantillas-zip',root||'/plantilla.zip');
 insert into storage.objects(bucket_id,name,created_at) values('imagenes-plantillas',root||'/vieja.png',now()-interval '2 days');
 perform set_config('role','authenticated',true);
 update public.plantillas set imagen_principal=root||'/principal.png',archivo_zip_path=root||'/plantilla.zip' where id=t;
 if (select count(*) from public.tembora_marcar_obsoletos(t))<>1 then raise exception 'FAIL limpieza debe marcar solo vieja sin referencia'; end if;
 blocked:=false;
 begin update public.plantillas set imagen_principal=root||'/vieja.png' where id=t; exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL reutilización de archivo retirado'; end if;
 blocked:=false;
 begin insert into public.imagenes_plantilla(plantilla_id,url,orden)values(t,root||'/vieja.png',0); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL galería reutiliza archivo retirado'; end if;
 perform public.tembora_enviar_plantilla(t);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_plantilla(t,'publicada',null);
 perform set_config('request.jwt.claim.sub',b::text,true);
 blocked:=false;
 begin perform public.tembora_marcar_obsoletos(t); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'FAIL comprador limpia plantilla'; end if;
 o:=public.tembora_crear_pedido(t);
 if public.tembora_crear_pedido(t)<>o then raise exception 'FAIL pedido duplicado'; end if;
 if not exists(select 1 from public.pedidos where id=o and monto=100 and comision_plataforma=20 and ingreso_vendedor=80 and vendedor_id=s and estado_pago='pendiente') then raise exception 'FAIL snapshot/reparto'; end if;
 if tembora_private.zip_comprado('plantillas-zip',root||'/plantilla.zip') then raise exception 'FAIL ZIP antes del pago'; end if;
 blocked:=false;
 begin update public.pedidos set estado_pago='verificado' where id=o; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'FAIL update directo permitido'; end if;
 blocked:=false;
 begin perform public.tembora_revisar_pago(o,true,'TEMP-OP'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'FAIL comprador aprueba'; end if;
 receipt:=b::text||'/'||o::text||'/evidencia.png';
 perform set_config('role','none',true);
 insert into storage.objects(bucket_id,name) values('comprobantes',receipt);
 perform set_config('role','authenticated',true);
 perform public.tembora_enviar_comprobante(o,receipt);
 perform public.tembora_enviar_comprobante(o,receipt); -- idempotente
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 if exists(select 1 from public.pedidos where id=o) then raise exception 'FAIL pedido ajeno visible'; end if;
 if tembora_private.comprobante_permitido(receipt,false) then raise exception 'FAIL comprobante ajeno visible'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_pago(o,false,'Captura ilegible');
 perform set_config('request.jwt.claim.sub',b::text,true);
 if tembora_private.zip_comprado('plantillas-zip',root||'/plantilla.zip') then raise exception 'FAIL ZIP rechazado'; end if;
 receipt:=b::text||'/'||o::text||'/corregida.png';
 perform set_config('role','none',true);
 insert into storage.objects(bucket_id,name) values('comprobantes',receipt);
 perform set_config('role','authenticated',true);
 perform public.tembora_enviar_comprobante(o,receipt);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_pago(o,true,'TEMP-'||o::text);
 perform public.tembora_revisar_pago(o,true,'TEMP-'||o::text); -- no duplica ingreso
 perform set_config('request.jwt.claim.sub',b::text,true);
 if not tembora_private.zip_comprado('plantillas-zip',root||'/plantilla.zip') then raise exception 'FAIL ZIP compra aprobada'; end if;
 if not exists(select 1 from storage.objects where bucket_id='plantillas-zip' and name=root||'/plantilla.zip') then raise exception 'FAIL RLS descarga'; end if;
 if tembora_private.comprobante_permitido(receipt,true) then raise exception 'FAIL evidencia aprobada editable'; end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 if exists(select 1 from storage.objects where bucket_id='plantillas-zip' and name=root||'/plantilla.zip') then raise exception 'FAIL ZIP ajeno'; end if;
 perform set_config('request.jwt.claim.sub',s::text,true);
 r:=public.tembora_solicitar_retiro(gen_random_uuid(),60,'900000000','TEMP TEST');
 blocked:=false;
 begin perform public.tembora_solicitar_retiro(gen_random_uuid(),60,'900000000','TEMP TEST'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL doble gasto'; end if;
 blocked:=false;
 begin update public.retiros set estado='pagado' where id=r; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'FAIL retiro autoaprobado'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_retiro(r,'rechazado','Destino incorrecto');
 perform set_config('request.jwt.claim.sub',s::text,true);
 r2:=public.tembora_solicitar_retiro(gen_random_uuid(),50,'900000000','TEMP TEST');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_retiro(r2,'aprobado',null);
 perform public.tembora_revisar_retiro(r2,'pagado','TEMP-'||r2::text);
 perform public.tembora_revisar_retiro(r2,'pagado','TEMP-'||r2::text);
 perform set_config('role','none',true);
 if tembora_private.saldo(s)<>30 then raise exception 'FAIL saldo final'; end if;
 if (select count(*) from public.movimientos_auditoria where entidad_id=o and accion='pago_verificado')<>1 then raise exception 'FAIL auditoría duplicada'; end if;
end $$;
select 'PASS: pedido, snapshot 20/80, rechazo/corrección/aprobación, RLS ZIP, evidencia, retiros, saldo y auditoría; fixtures revertidos al finalizar' as resultado;
rollback;
