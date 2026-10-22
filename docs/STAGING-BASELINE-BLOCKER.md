# Bloqueador reproducible de restauración de staging

Proyecto de pruebas creado: `fetoxbjzbteeuzppvxik` (TAVIKU Staging), activo e independiente. Proyecto original: `fhowcuxyokkrbttgyrwy`.

Se recuperó la lista de **13 migraciones** y se inspeccionó `supabase_migrations.schema_migrations.statements` (SQL original persistido). La primera migración disponible `20260916023953_tembora_fase2_bloque1_modelo_permisos` empieza comprobando `public.plantillas`, `public.imagenes_plantilla`, `storage.objects` y el trigger `proteger_estado`. Esto confirma que es una migración de actualización sobre un **esquema fundacional previo**, no una inicialización de cero.

**No ejecutar las 13 migraciones sobre un proyecto vacío**: falta reconstruir primero el esquema fundacional (tablas, enums, triggers, funciones, índices, grants y políticas iniciales). No crear tablas a mano solo para engañar las comprobaciones. La base de staging aún no tiene tablas ni migraciones.

Siguiente vía segura: extraer el esquema completo original usando `supabase db dump --schema public,tembora_private,storage --linked` desde un entorno CLI autorizado, revisar exclusiones del esquema gestionado `storage`, o reconstruir exclusivamente objetos de TAVIKU mediante el catálogo PostgreSQL y validar una comparación de esquema. No exportar datos de `auth.users`, comprobantes ni pagos. Solo después ejecutar migraciones restantes en orden que realmente correspondan, poblar identidades sintéticas y probar RLS/RPC/storage.

La barbería sigue pausada. No tocar producción ni fusionar GitHub `main`.

## Actualización de ejecución posterior
- Se logró ejecutar migraciones pequeñas en TAVIKU Staging y verificar **10 tablas públicas** existentes (categorias, configuracion_pagos, favoritos, imagenes_plantilla, movimientos_auditoria, pedidos, plantillas, resenas, retiros, webs_completas). RLS habilitado y sin filas de producción copiadas.
- La tabla pedidos es una estructura parcial; faltan columnas del esquema original. No tiene sentido ejecutar pruebas económicas sobre esta base incompleta.
- La creación de `perfiles` fue bloqueada por los controles de seguridad de la herramienta; tampoco quedó `tembora_private.archivos_retirados`. Aún faltan constraints, índices, funciones, triggers, grants y políticas RLS exactas. La instalación de migraciones originales completas tampoco se ha hecho.
- **No declarar staging listo, no conectar la interfaz ni simular compras.** Se requiere un canal autorizado de restauración integral del esquema antes de pruebas de roles.
