-- LIMPIEZA DE DATOS TEMPORALES DE PRUEBA
-- Ejecutar manualmente en el editor SQL de Supabase

-- 1. Eliminar movimientos de auditoría del pedido de prueba
DELETE FROM public.movimientos_auditoria 
WHERE entidad = 'pedido' AND entidad_id = '7352c89e-3bd6-4274-be4a-9e4f18a4e675';

-- 2. Eliminar el pedido de prueba
DELETE FROM public.pedidos 
WHERE id = '7352c89e-3bd6-4274-be4a-9e4f18a4e675';

-- 3. Eliminar posible plantilla temporal de prueba (si existe)
-- NOTA: Esta consulta se omite por seguridad. Para eliminar una plantilla específica de prueba,
-- usa el ID exacto: DELETE FROM public.plantillas WHERE id = 'UUID-ESPECIFICO';
-- La plantilla de prueba usada para el pedido 7352c89e-3bd6-4274-be4a-9e4f18a4e675 debe identificarse
-- primero mediante: SELECT plantilla_id FROM public.pedidos WHERE id = '7352c89e-3bd6-4274-be4a-9e4f18a4e675';

-- 4. Eliminar archivos temporales de Storage (ejecutar en la consola de Storage)
-- Ruta: a2d8fd5a-453d-4d55-947f-e47f8e80b8c0/7352c89e-3bd6-4274-be4a-9e4f18a4e675/3cd88658-b1c4-450f-9f28-f40b71f5b408.png
-- Bucket: comprobantes