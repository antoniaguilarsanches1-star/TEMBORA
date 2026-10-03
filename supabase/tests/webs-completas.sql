-- Pruebas reales de RLS, sin dejar datos ni cambiar usuarios existentes.
begin;
select set_config('test.admin', (select id::text from public.perfiles where rol='admin' limit 1), true);
select set_config('test.comprador', (select id::text from public.perfiles where rol='comprador' limit 1), true);
select set_config('test.vendedor', (select id::text from public.perfiles where rol='vendedor' limit 1), true);
insert into public.webs_completas(id,nombre,tipo_negocio,descripcion,funciones,portada,demo_url,estado) values
 ('10000000-0000-4000-8000-000000000001','Prueba publicada','Barbería','Solo prueba transaccional',array['Reservas'],'10000000-0000-4000-8000-000000000001.png','https://example.com','publicada'),
 ('10000000-0000-4000-8000-000000000002','Prueba oculta','Tienda','Solo prueba transaccional','{}',null,'','oculta');
set local role anon;
do $$ begin
 if (select count(*) from public.webs_completas where id::text like '10000000-%') <> 1 then raise exception 'anon: visibilidad incorrecta'; end if;
 begin insert into public.webs_completas(nombre,tipo_negocio,descripcion) values('Ataque','Tienda','No permitido'); raise exception 'anon pudo insertar'; exception when insufficient_privilege then null; end;
 begin update public.webs_completas set nombre='Ataque'; raise exception 'anon pudo actualizar'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare r text; affected integer; begin
 foreach r in array array['comprador','vendedor'] loop
   if nullif(current_setting('test.' || r),'') is null then raise exception 'Falta usuario de prueba para %',r; end if;
   perform set_config('request.jwt.claims',json_build_object('sub',current_setting('test.' || r),'role','authenticated')::text,true);
   set local role authenticated;
   if (select count(*) from public.webs_completas where id::text like '10000000-%') <> 1 then raise exception '%: visibilidad incorrecta',r; end if;
   begin insert into public.webs_completas(nombre,tipo_negocio,descripcion) values('Ataque','Tienda','No permitido'); raise exception '% pudo insertar',r; exception when insufficient_privilege then null; end;
   update public.webs_completas set nombre='Ataque' where id='10000000-0000-4000-8000-000000000001';
   get diagnostics affected = row_count;
   if affected <> 0 then raise exception '% pudo editar',r; end if;
   begin delete from public.webs_completas; raise exception '% pudo eliminar',r; exception when insufficient_privilege then null; end;
   begin insert into storage.objects(bucket_id,name) values ('webs-completas','10000000-0000-4000-8000-000000000003.png'); raise exception '% pudo subir portada',r; exception when insufficient_privilege then null; end;
   reset role;
 end loop;
end $$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare affected integer; begin
 if not public.es_admin() then raise exception 'Falta sesión admin de prueba'; end if;
 if (select count(*) from public.webs_completas where id::text like '10000000-%') <> 2 then raise exception 'admin no ve borradores/ocultas'; end if;
 insert into public.webs_completas(id,nombre,tipo_negocio,descripcion) values('10000000-0000-4000-8000-000000000003','Admin crea','Consultorio','Prueba');
 update public.webs_completas set estado='oculta',posicion=5 where id='10000000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'admin no puede ocultar'; end if;
 update public.webs_completas set estado='publicada',posicion=1 where id='10000000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'admin no puede publicar'; end if;
 insert into storage.objects(bucket_id,name) values ('webs-completas','10000000-0000-4000-8000-000000000001.png');
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='webs-completas' and name='10000000-0000-4000-8000-000000000001.png') then raise exception 'Portada publicada no visible'; end if;
end $$;
reset role;
update public.webs_completas set estado='oculta' where id='10000000-0000-4000-8000-000000000001';
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='webs-completas' and name='10000000-0000-4000-8000-000000000001.png') then raise exception 'Portada oculta visible'; end if;
end $$;
reset role;
select 'PASS: público, comprador, vendedor, admin, publicar/ocultar y portadas' as resultado;
rollback;
