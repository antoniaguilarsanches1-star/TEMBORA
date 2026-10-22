-- Fase 6: validacion estructural sin escrituras. No contiene datos privados.
WITH checks AS (
 SELECT 'rls_public_tables' name,(SELECT count(*)=11 AND bool_and(c.relrowsecurity)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('perfiles','categorias','plantillas','imagenes_plantilla','favoritos','pedidos',
 'retiros','resenas','configuracion_pagos','movimientos_auditoria','webs_completas')) ok
 UNION ALL SELECT 'role_not_directly_editable',
 NOT has_column_privilege('authenticated','public.perfiles','rol','UPDATE')
 UNION ALL SELECT 'comprobantes_private',(SELECT NOT public FROM storage.buckets WHERE id='comprobantes')
 UNION ALL SELECT 'zip_private',(SELECT NOT public FROM storage.buckets WHERE id='plantillas-zip')
 UNION ALL SELECT 'gallery_private',(SELECT NOT public FROM storage.buckets WHERE id='imagenes-plantillas')
 UNION ALL SELECT 'restrictive_retired_files',(SELECT permissive='RESTRICTIVE'
 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='archivos_no_reutilizar')
 UNION ALL SELECT 'verified_zip_requires_purchase',EXISTS(
 SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
 AND policyname='zip_compra_verificada' AND qual LIKE '%zip_comprado%')
 UNION ALL SELECT 'favorites_owned',EXISTS(
 SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='favoritos'
 AND cmd='SELECT' AND qual LIKE '%auth.uid()%')
)
SELECT name,coalesce(ok,false) AS ok FROM checks ORDER BY name;
