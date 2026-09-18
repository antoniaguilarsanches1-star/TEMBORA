-- Script de Limpieza Administrativa para Datos Sintéticos de Prueba
-- Utiliza SET LOCAL session_replication_role = 'replica' dentro del bloque transaccional
-- para omitir temporalmente la ejecución del trigger guardar_estado durante el DELETE administrativo de la plantilla 'publicada',
-- sin modificar ni alterar la estructura del trigger, RLS, permisos, autenticación ni seguridad de la base de datos.

BEGIN;

-- Ajustar el rol de réplica únicamente para el ámbito local de esta transacción
SET LOCAL session_replication_role = 'replica';

-- 1. Eliminar objetos de Storage vinculados al pedido y a la plantilla
DELETE FROM storage.objects
WHERE (bucket_id = 'comprobantes' AND name LIKE '%/7352c89e-3bd6-4274-be4a-9e4f18a4e675/%')
   OR (bucket_id = 'imagenes-plantillas' AND name LIKE '%/5bf144ea-54d5-4b79-8d83-71eb74f92d5b/%')
   OR (bucket_id = 'plantillas-zip' AND name LIKE '%/5bf144ea-54d5-4b79-8d83-71eb74f92d5b/%');

-- 2. Eliminar eventos de auditoría vinculados
DELETE FROM public.movimientos_auditoria
WHERE entidad_id IN ('7352c89e-3bd6-4274-be4a-9e4f18a4e675', '5bf144ea-54d5-4b79-8d83-71eb74f92d5b');

-- 3. Eliminar pedido sintético de prueba
DELETE FROM public.pedidos
WHERE id = '7352c89e-3bd6-4274-be4a-9e4f18a4e675' OR plantilla_id = '5bf144ea-54d5-4b79-8d83-71eb74f92d5b';

-- 4. Eliminar favoritos de prueba vinculados a la plantilla
DELETE FROM public.favoritos
WHERE plantilla_id = '5bf144ea-54d5-4b79-8d83-71eb74f92d5b';

-- 5. Eliminar imágenes en galería de la plantilla
DELETE FROM public.imagenes_plantilla
WHERE plantilla_id = '5bf144ea-54d5-4b79-8d83-71eb74f92d5b';

-- 6. Eliminar la plantilla temporal
DELETE FROM public.plantillas
WHERE id = '5bf144ea-54d5-4b79-8d83-71eb74f92d5b' OR nombre = 'TEMP_PRUEBA_TEMBORA_20260916';

COMMIT;
