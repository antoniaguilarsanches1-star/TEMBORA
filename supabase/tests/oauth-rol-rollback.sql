begin;
do $$
declare g uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); r text;
begin
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
(g,'{"provider":"google"}','{"rol":"admin","full_name":"TEMP OAuth"}'),
(f,'{"provider":"facebook"}','{}'),
(e,'{"provider":"email"}','{"rol":"vendedor"}');
if exists(select 1 from public.perfiles where id in(g,f)) then raise exception 'Social autoasignado'; end if;
if not exists(select 1 from public.perfiles where id=e and rol='vendedor') then raise exception 'Registro email alterado'; end if;
perform set_config('request.jwt.claim.sub',g::text,true);
perform set_config('request.jwt.claims',json_build_object('sub',g,'role','authenticated')::text,true);
set local role authenticated;
begin
perform public.tembora_elegir_rol_social('admin');
raise exception 'ADMIN_PERMITIDO';
exception when others then if sqlerrm='ADMIN_PERMITIDO' then raise; end if; end;
r:=public.tembora_elegir_rol_social('vendedor');
if r<>'vendedor' then raise exception 'No guardó vendedor'; end if;
r:=public.tembora_elegir_rol_social('comprador');
if r<>'vendedor' then raise exception 'Reasignó rol existente'; end if;
reset role;
perform set_config('request.jwt.claim.sub',f::text,true);
perform set_config('request.jwt.claims',json_build_object('sub',f,'role','authenticated')::text,true);
set local role authenticated;
r:=public.tembora_elegir_rol_social('comprador');
if r<>'comprador' then raise exception 'No guardó comprador'; end if;
reset role;
if has_function_privilege('anon','public.tembora_elegir_rol_social(text)','execute') then raise exception 'Anon permitido'; end if;
end $$;
select 'PASS: Google/Facebook sin perfil inicial, elección comprador/vendedor, admin denegado, rol inmutable, email intacto, anon sin EXECUTE' resultado;
rollback;
