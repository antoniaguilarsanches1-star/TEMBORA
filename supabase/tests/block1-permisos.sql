begin;
-- Run inside BEGIN / ROLLBACK. All identities and object metadata are synthetic.
-- No passwords, sessions, uploads or real profile changes.
create temporary table block1_results(test text,passed boolean,observed text);
create function pg_temp.block1_case(label text,db_role text,actor uuid,stmt text,expected text)
returns void language plpgsql security invoker as $$
declare actual text; code text;
begin
 perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role',db_role)::text,true);
 begin
   execute format('set local role %I',db_role);
   execute stmt into actual;
 exception when others then
   get stacked diagnostics code=returned_sqlstate;
   actual:='ERROR:'||code;
 end;
 reset role;
 insert into block1_results values(label,actual is not distinct from expected,coalesce(actual,'NULL'));
end;
$$;
do $$
declare s1 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();buyer uuid:=gen_random_uuid();adm uuid:=gen_random_uuid();
 p1 uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();p3 uuid:=gen_random_uuid();pa uuid:=gen_random_uuid();
 i1 uuid:=gen_random_uuid();cat bigint; root1 text;root2 text;roota text;
begin
 insert into auth.users(id,raw_user_meta_data) values
 (s1,'{"rol":"vendedor"}'),(s2,'{"rol":"vendedor"}'),(buyer,'{"rol":"comprador"}'),(adm,'{"rol":"comprador"}');
 update public.perfiles set rol='admin' where id=adm;
 select min(id) into cat from public.categorias;
 root1:=s1||'/'||p1||'/'; root2:=s2||'/'||p2||'/';roota:=adm||'/'||pa||'/';
 perform set_config('storage.allow_delete_query','true',true);

 perform pg_temp.block1_case('anon cannot create','anon',null,
   format('insert into public.plantillas(vendedor_id,nombre) values (%L,''test'') returning id',s1),'ERROR:42501');
 perform pg_temp.block1_case('buyer cannot create','authenticated',buyer,
   format('insert into public.plantillas(vendedor_id,nombre) values (%L,''test'') returning id',buyer),'ERROR:42501');
 perform pg_temp.block1_case('seller cannot assign another owner','authenticated',s1,
   format('insert into public.plantillas(vendedor_id,nombre) values (%L,''test'') returning id',s2),'ERROR:42501');
 perform pg_temp.block1_case('new row forced pending even if published requested','authenticated',s1,
   format('insert into public.plantillas(id,vendedor_id,categoria_id,nombre,descripcion,precio,estado) values (%L,%L,%s,''Test'',''Description'',20,''publicada'') returning estado',p1,s1,cat),'pendiente');
 perform pg_temp.block1_case('second seller creates own row','authenticated',s2,
   format('insert into public.plantillas(id,vendedor_id,nombre) values (%L,%L,''Test2'') returning estado',p2,s2),'pendiente');
 perform pg_temp.block1_case('owner sees pending','authenticated',s1,format('select count(*)::text from public.plantillas where id=%L',p1),'1');
 perform pg_temp.block1_case('other seller cannot see pending','authenticated',s2,format('select count(*)::text from public.plantillas where id=%L',p1),'0');
 perform pg_temp.block1_case('buyer cannot see pending','authenticated',buyer,format('select count(*)::text from public.plantillas where id=%L',p1),'0');
 perform pg_temp.block1_case('anon cannot see pending','anon',null,format('select count(*)::text from public.plantillas where id=%L',p1),'0');
 perform pg_temp.block1_case('admin sees pending','authenticated',adm,format('select count(*)::text from public.plantillas where id=%L',p1),'1');
 perform pg_temp.block1_case('owner cannot publish directly','authenticated',s1,format('update public.plantillas set estado=''publicada'' where id=%L returning estado',p1),'ERROR:42501');
 perform pg_temp.block1_case('owner cannot reject directly','authenticated',s1,format('update public.plantillas set estado=''rechazada'' where id=%L returning estado',p1),'ERROR:42501');
 perform pg_temp.block1_case('owner cannot change owner','authenticated',s1,format('update public.plantillas set vendedor_id=%L where id=%L returning estado',s2,p1),'ERROR:42501');
 perform pg_temp.block1_case('other seller cannot appropriate row','authenticated',s2,format('with x as (update public.plantillas set vendedor_id=%L where id=%L returning id) select count(*)::text from x',s2,p1),'0');
 perform pg_temp.block1_case('owner cannot forge metrics','authenticated',s1,format('update public.plantillas set ventas=500 where id=%L returning estado',p1),'ERROR:42501');
 perform pg_temp.block1_case('owner cannot forge review','authenticated',s1,format('update public.plantillas set revisada_por=%L where id=%L returning estado',adm,p1),'ERROR:42501');
 perform pg_temp.block1_case('no self elevation through profile','authenticated',s1,format('update public.perfiles set rol=''admin'' where id=%L returning rol',s1),'ERROR:42501');
 perform pg_temp.block1_case('no self elevation through role RPC','authenticated',s1,format('select public.tembora_admin_cambiar_rol(%L,''admin'')',s1),'ERROR:42501');
 perform pg_temp.block1_case('profile still readable for auth','authenticated',s1,format('select rol from public.perfiles where id=%L',s1),'vendedor');
 perform pg_temp.block1_case('admin helper preserved','authenticated',adm,'select public.es_admin()::text','true');
 perform pg_temp.block1_case('buyer helper preserved','authenticated',buyer,'select public.es_admin()::text','false');
 perform pg_temp.block1_case('categories still public','anon',null,'select (count(*)>0)::text from public.categorias','true');
 perform pg_temp.block1_case('categories not editable by seller','authenticated',s1,'update public.categorias set nombre=nombre returning nombre','ERROR:42501');
 perform pg_temp.block1_case('no truncate bypass','authenticated',s1,'truncate public.imagenes_plantilla','ERROR:42501');
 perform pg_temp.block1_case('no anonymous review RPC','anon',null,format('select public.tembora_revisar_plantilla(%L,''publicada'')',p1),'ERROR:42501');
 perform pg_temp.block1_case('no seller review RPC','authenticated',s1,format('select public.tembora_revisar_plantilla(%L,''publicada'')',p1),'ERROR:42501');
 perform pg_temp.block1_case('admin cannot approve unsubmitted','authenticated',adm,format('select public.tembora_revisar_plantilla(%L,''publicada'')',p1),'ERROR:42501');
 perform pg_temp.block1_case('submission requires assets','authenticated',s1,format('select public.tembora_enviar_plantilla(%L)',p1),'ERROR:23514');

 perform pg_temp.block1_case('owner uploads primary metadata','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''imagenes-plantillas'',%L) returning ''ok''',root1||'principal.png'),'ok');
 perform pg_temp.block1_case('owner uploads zip metadata','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''plantillas-zip'',%L) returning ''ok''',root1||'plantilla.zip'),'ok');
 perform pg_temp.block1_case('other seller cannot upload into owner path','authenticated',s2,format('insert into storage.objects(bucket_id,name) values (''plantillas-zip'',%L) returning ''ok''',root1||'intruso.zip'),'ERROR:42501');
 perform pg_temp.block1_case('buyer cannot upload template files','authenticated',buyer,format('insert into storage.objects(bucket_id,name) values (''plantillas-zip'',%L) returning ''ok''',buyer||'/'||p1||'/test.zip'),'ERROR:42501');
 perform pg_temp.block1_case('upload without parent denied','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''plantillas-zip'',%L) returning ''ok''',s1||'/'||gen_random_uuid()||'/test.zip'),'ERROR:42501');
 perform pg_temp.block1_case('cross-owner parent folder denied','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''plantillas-zip'',%L) returning ''ok''',s1||'/'||p2||'/test.zip'),'ERROR:42501');
 perform pg_temp.block1_case('unsafe object path denied','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''imagenes-plantillas'',%L) returning ''ok''',root1||'../test.png'),'ERROR:42501');
 perform pg_temp.block1_case('owner reads private zip','authenticated',s1,format('select count(*)::text from storage.objects where name=%L',root1||'plantilla.zip'),'1');
 perform pg_temp.block1_case('admin reads private zip','authenticated',adm,format('select count(*)::text from storage.objects where name=%L',root1||'plantilla.zip'),'1');
 perform pg_temp.block1_case('other seller cannot read zip','authenticated',s2,format('select count(*)::text from storage.objects where name=%L',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('buyer cannot read zip','authenticated',buyer,format('select count(*)::text from storage.objects where name=%L',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('anon cannot read draft image','anon',null,format('select count(*)::text from storage.objects where name=%L',root1||'principal.png'),'0');
 perform pg_temp.block1_case('owner attaches correct paths','authenticated',s1,format('update public.plantillas set archivo_zip_path=%L,imagen_principal=%L where id=%L returning ''ok''',root1||'plantilla.zip',root1||'principal.png',p1),'ok');
 perform pg_temp.block1_case('owner cannot attach foreign zip','authenticated',s1,format('update public.plantillas set archivo_zip_path=%L where id=%L returning ''ok''',root2||'plantilla.zip',p1),'ERROR:23514');
 perform pg_temp.block1_case('owner adds gallery','authenticated',s1,format('insert into public.imagenes_plantilla(id,plantilla_id,url) values (%L,%L,%L) returning ''ok''',i1,p1,root1||'principal.png'),'ok');
 perform pg_temp.block1_case('gallery cannot reference foreign path','authenticated',s1,format('insert into public.imagenes_plantilla(plantilla_id,url) values (%L,%L) returning ''ok''',p1,root2||'principal.png'),'ERROR:23514');
 perform pg_temp.block1_case('other seller cannot add gallery','authenticated',s2,format('insert into public.imagenes_plantilla(plantilla_id,url) values (%L,%L) returning ''ok''',p1,root1||'principal.png'),'ERROR:42501');
 perform pg_temp.block1_case('no moving ZIP into public avatar bucket','authenticated',s1,format('with x as (update storage.objects set bucket_id=''avatares'' where name=%L returning id) select count(*)::text from x',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('cannot delete parent leaving files','authenticated',s1,format('delete from public.plantillas where id=%L returning ''ok''',p1),'ERROR:23514');

 perform pg_temp.block1_case('unused draft image upload','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''imagenes-plantillas'',%L) returning ''ok''',root1||'unused.png'),'ok');
 perform pg_temp.block1_case('gallery cannot be reassigned','authenticated',s1,format('update public.imagenes_plantilla set plantilla_id=%L where id=%L returning ''ok''',p2,i1),'ERROR:42501');
 perform pg_temp.block1_case('complete submission succeeds','authenticated',s1,format('select public.tembora_enviar_plantilla(%L)::text',p1),'');
 perform pg_temp.block1_case('submitted owner cannot edit content','authenticated',s1,format('with x as (update public.plantillas set nombre=''Changed'' where id=%L returning id) select count(*)::text from x',p1),'0');
 perform pg_temp.block1_case('submitted owner cannot delete','authenticated',s1,format('with x as (delete from public.plantillas where id=%L returning id) select count(*)::text from x',p1),'0');
 perform pg_temp.block1_case('submitted owner cannot add files','authenticated',s1,format('insert into storage.objects(bucket_id,name) values (''imagenes-plantillas'',%L) returning ''ok''',root1||'late.png'),'ERROR:42501');
 perform pg_temp.block1_case('submitted owner cannot delete zip','authenticated',s1,format('with x as (delete from storage.objects where name=%L returning id) select count(*)::text from x',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('submitted owner cannot add gallery','authenticated',s1,format('insert into public.imagenes_plantilla(plantilla_id,url) values (%L,%L) returning ''ok''',p1,root1||'principal.png'),'ERROR:42501');

 perform pg_temp.block1_case('submitted gallery cannot be edited','authenticated',s1,format('with x as (update public.imagenes_plantilla set orden=3 where id=%L returning id) select count(*)::text from x',i1),'0');
 perform pg_temp.block1_case('submitted gallery cannot be deleted','authenticated',s1,format('with x as (delete from public.imagenes_plantilla where id=%L returning id) select count(*)::text from x',i1),'0');
 perform pg_temp.block1_case('admin cannot edit submitted content','authenticated',adm,format('update public.plantillas set estado=''publicada'',nombre=''Changed'' where id=%L returning estado',p1),'ERROR:42501');
 perform pg_temp.block1_case('rejection requires reason','authenticated',adm,format('select public.tembora_revisar_plantilla(%L,''rechazada'')::text',p1),'ERROR:23514');
 perform pg_temp.block1_case('admin rejects','authenticated',adm,format('select public.tembora_revisar_plantilla(%L,''rechazada'',''Corregir descripcion'')::text',p1),'');
 perform pg_temp.block1_case('rejection audit recorded','authenticated',s1,format('select (revisada_por=%L and revisada_at is not null and motivo_rechazo=''Corregir descripcion'')::text from public.plantillas where id=%L',adm,p1),'true');
 perform pg_temp.block1_case('buyer cannot see rejected','authenticated',buyer,format('select count(*)::text from public.plantillas where id=%L',p1),'0');
 perform pg_temp.block1_case('owner edits rejected','authenticated',s1,format('update public.plantillas set descripcion=''Corregida'' where id=%L returning estado',p1),'rechazada');
 perform pg_temp.block1_case('owner may remove gallery while rejected','authenticated',s1,format('with x as (delete from public.imagenes_plantilla where id=%L returning id) select count(*)::text from x',i1),'1');
 perform pg_temp.block1_case('resubmission succeeds','authenticated',s1,format('select public.tembora_enviar_plantilla(%L)::text',p1),'');
 perform pg_temp.block1_case('admin publishes','authenticated',adm,format('select public.tembora_revisar_plantilla(%L,''publicada'')::text',p1),'');
 perform pg_temp.block1_case('anon sees published','anon',null,format('select count(*)::text from public.plantillas where id=%L',p1),'1');
 perform pg_temp.block1_case('buyer sees published','authenticated',buyer,format('select count(*)::text from public.plantillas where id=%L',p1),'1');
 perform pg_temp.block1_case('public sees approved image only','anon',null,format('select count(*)::text from storage.objects where name=%L',root1||'principal.png'),'1');

 perform pg_temp.block1_case('public cannot see unused image even when parent published','anon',null,format('select count(*)::text from storage.objects where name=%L',root1||'unused.png'),'0');
 perform pg_temp.block1_case('published image cannot be removed','authenticated',s1,format('with x as (delete from storage.objects where name=%L returning id) select count(*)::text from x',root1||'principal.png'),'0');
 perform pg_temp.block1_case('published ZIP stays private','anon',null,format('select count(*)::text from storage.objects where name=%L',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('buyer still cannot read published ZIP','authenticated',buyer,format('select count(*)::text from storage.objects where name=%L',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('published owner cannot edit','authenticated',s1,format('with x as (update public.plantillas set nombre=''Changed'' where id=%L returning id) select count(*)::text from x',p1),'0');
 perform pg_temp.block1_case('published owner cannot delete','authenticated',s1,format('with x as (delete from public.plantillas where id=%L returning id) select count(*)::text from x',p1),'0');
 perform pg_temp.block1_case('published ZIP cannot be replaced','authenticated',s1,format('with x as (update storage.objects set metadata=''{}'' where name=%L returning id) select count(*)::text from x',root1||'plantilla.zip'),'0');
 perform pg_temp.block1_case('admin cannot change owner','authenticated',adm,format('update public.plantillas set vendedor_id=%L where id=%L returning estado',adm,p1),'ERROR:42501');

 perform pg_temp.block1_case('admin creates pending own row','authenticated',adm,format('insert into public.plantillas(id,vendedor_id,nombre,estado) values (%L,%L,''Admin own'',''publicada'') returning estado',pa,adm),'pendiente');
 perform pg_temp.block1_case('admin cannot self approve through RPC','authenticated',adm,format('select public.tembora_revisar_plantilla(%L,''publicada'')::text',pa),'ERROR:42501');
 perform pg_temp.block1_case('admin cannot self approve directly','authenticated',adm,format('update public.plantillas set estado=''publicada'' where id=%L returning estado',pa),'ERROR:42501');
 perform pg_temp.block1_case('other seller cannot delete foreign draft','authenticated',s1,format('with x as (delete from public.plantillas where id=%L returning id) select count(*)::text from x',p2),'0');
 perform pg_temp.block1_case('owner can delete empty draft','authenticated',s2,format('with x as (delete from public.plantillas where id=%L returning id) select count(*)::text from x',p2),'1');
end;
$$;
select * from block1_results order by passed,test;
rollback;
