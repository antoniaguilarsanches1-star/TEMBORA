# Bloqueador reproducible de restauración de staging

Proyecto de pruebas creado: `fetoxbjzbteeuzppvxik` (TAVIKU Staging), activo e independiente. Proyecto original: `fhowcuxyokkrbttgyrwy`.

Se recuperó la lista de **13 migraciones** y se inspeccionó `supabase_migrations.schema_migrations.statements` (SQL original persistido). La primera migración disponible `20260916023953_tembora_fase2_bloque1_modelo_permisos` empieza comprobando `public.plantillas`, `public.imagenes_plantilla`, `storage.objects` y el trigger `proteger_estado`. Esto confirma que es una migración de actualización sobre un **esquema fundacional previo**, no una inicialización de cero.

**No ejecutar las 13 migraciones sobre un proyecto vacío**: falta reconstruir primero el esquema fundacional (tablas, enums, triggers, funciones, índices, grants y políticas iniciales). No crear tablas a mano solo para engañar las comprobaciones. La base de staging aún no tiene tablas ni migraciones.

Siguiente vía segura: extraer el esquema completo original usando `supabase db dump --schema public,tembora_private,storage --linked` desde un entorno CLI autorizado, revisar exclusiones del esquema gestionado `storage`, o reconstruir exclusivamente objetos de TAVIKU mediante el catálogo PostgreSQL y validar una comparación de esquema. No exportar datos de `auth.users`, comprobantes ni pagos. Solo después ejecutar migraciones restantes en orden que realmente correspondan, poblar identidades sintéticas y probar RLS/RPC/storage.

La barbería sigue pausada. No tocar producción ni fusionar GitHub `main`.
