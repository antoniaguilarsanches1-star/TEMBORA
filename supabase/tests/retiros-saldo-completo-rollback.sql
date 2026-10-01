-- Una revisión final, con identidades y movimientos sintéticos; revierte todo.
begin;
do $$
declare s uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); a uuid:=gen_random_uuid();
 t uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); solicitud uuid:=gen_random_uuid(); r uuid; r2 uuid;
 blocked boolean; v numeric; n integer; bad text;
begin
 insert into auth.users(id,raw_user_meta_data) values
 (s,'{"rol":"vendedor","nombre_completo":"TEMP_TEST_RETIROS"}'),
 (b,'{"rol":"comprador","nombre_completo":"TEMP_TEST_RETIROS"}'),
 (a,'{"rol":"comprador","nombre_completo":"TEMP_TEST_RETIROS"}');
 update public.perfiles set rol='admin' where id=a;
 perform set_config('request.jwt.claim.sub',s::text,true);
 insert into public.plantillas(id,vendedor_id,nombre,descripcion,precio,tecnologias)
 values(t,s,'TEMP_TEST_RETIROS',repeat('x',100),49,array['HTML']);
 insert into public.pedidos(id,comprador_id,vendedor_id,plantilla_id,monto,estado_pago,plantilla_nombre,zip_path,yape_numero,yape_titular,revisado_por)
 values(o,b,s,t,49,'verificado','TEMP_TEST_RETIROS','fixture.zip','900000000','Prueba',a);
 perform set_config('role','authenticated',true);
 blocked:=false;
 begin perform public.tembora_solicitar_retiro(solicitud,50,'900000000','José Pérez'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL S/39.20 permite retiro'; end if;
 perform set_config('role','none',true);
 if tembora_private.saldo(s)<>39.20 then raise exception 'FAIL saldo inicial'; end if;
 update public.pedidos set monto=62.50 where id=o; -- saldo exacto S/50
 perform set_config('role','authenticated',true);
 foreach bad in array array['12345678','1234567890','12345678a'] loop
  blocked:=false;
  begin perform public.tembora_solicitar_retiro(solicitud,50,bad,'José Pérez'); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'FAIL Yape inválido'; end if;
 end loop;
 foreach bad in array array['A','  ','Ana1','Ana-Pérez'] loop
  blocked:=false;
  begin perform public.tembora_solicitar_retiro(solicitud,50,'123456789',bad); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'FAIL titular inválido'; end if;
 end loop;
 r:=public.tembora_solicitar_retiro(solicitud,50,'123456789','José Pérez');
 if public.tembora_solicitar_retiro(solicitud,50,'123456789','José Pérez')<>r then raise exception 'FAIL idempotencia'; end if;
 perform set_config('role','none',true);
 if tembora_private.saldo(s)<>0 then raise exception 'FAIL reserva'; end if;
 update public.pedidos set monto=150 where id=o; -- nuevo disponible S/70, todavía pendiente
 perform set_config('role','authenticated',true);
 blocked:=false;
 begin perform public.tembora_solicitar_retiro(gen_random_uuid(),70,'123456789','José Pérez'); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL segundo pendiente'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 select count(*) into n from public.retiros where id=r;
 if n<>0 then raise exception 'FAIL aislamiento de lectura'; end if;
 blocked:=false;
 begin perform public.tembora_solicitar_retiro(gen_random_uuid(),70,'123456789','José Pérez'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'FAIL comprador retira'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_retiro(r,'rechazado','Prueba de rechazo');
 perform set_config('role','none',true);
 if tembora_private.saldo(s)<>120 then raise exception 'FAIL devolución al rechazar'; end if;
 perform set_config('request.jwt.claim.sub',s::text,true);
 perform set_config('role','authenticated',true);
 foreach v in array array[50,121]::numeric[] loop
  blocked:=false;
  begin perform public.tembora_solicitar_retiro(gen_random_uuid(),v,'123456789','José Pérez'); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'FAIL monto parcial o excesivo'; end if;
 end loop;
 r2:=public.tembora_solicitar_retiro(gen_random_uuid(),120,'123456789','Li');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.tembora_revisar_retiro(r2,'aprobado',null);
 blocked:=false;
 begin perform public.tembora_revisar_retiro(r2,'pagado',''); exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL pago sin operación'; end if;
 perform public.tembora_revisar_retiro(r2,'pagado','TEST-'||r2::text);
 perform public.tembora_revisar_retiro(r2,'pagado','TEST-'||r2::text);
 if not exists(select 1 from public.retiros where id=r2 and pagado_at is not null and referencia_pago=upper('TEST-'||r2::text) and estado='pagado') then raise exception 'FAIL datos de pago'; end if;
 perform set_config('role','none',true);
 if tembora_private.saldo(s)<>0 then raise exception 'FAIL saldo tras pago'; end if;
 if (select count(*) from public.retiros where vendedor_id=s)<>2 then raise exception 'FAIL duplicados'; end if;
 if (select coalesce(sum(monto),0) from public.retiros where vendedor_id=s and estado in('pendiente','aprobado'))<>0 then raise exception 'FAIL reserva pagada'; end if;
end $$;
rollback;
select 'PASS: mínimo, saldo completo, validación, reserva, pendiente, idempotencia, aislamiento, rechazo y pago; fixtures revertidos' as resultado;
