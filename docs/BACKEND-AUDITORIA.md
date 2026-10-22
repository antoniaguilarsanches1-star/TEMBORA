# TAVIKU — Fase 6, auditoría inicial de Supabase

Fecha: 22 de octubre de 2026. Solo consultas de lectura, sin DDL, escrituras ni operaciones de pago.

## Base de producción
Proyecto `PlantillaPE` (`fhowcuxyokkrbttgyrwy`). Se comprobaron 11 tablas de `public` y todas tienen RLS habilitado. RLS habilitado **no** demuestra que cada política sea correcta; faltan pruebas como comprador, vendedor y administrador.

## Avisos del asesor de seguridad
1. Tres funciones `SECURITY DEFINER` son ejecutables por `authenticated`: `es_admin()`, `es_vendedor()`, `tembora_admin_cambiar_rol(uuid,text)`. Se verificó por consulta que poseen este privilegio. No asumir escalada de privilegios sin inspeccionar su implementación y ejecutar pruebas de abuso. No revocar permisos a ciegas: podrían afectar funciones y políticas necesarias.
   Documentación: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
2. Protección contra contraseñas filtradas deshabilitada. Revisar compatibilidad del plan y configurar en la etapa de seguridad: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
3. `tembora_private.archivos_retirados` tiene RLS sin políticas. Al ser un esquema privado, puede ser intencional; inspeccionar privilegios antes de intervenir.
   Documentación: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Pruebas realizadas
- GitHub Actions ejecución `39820301791`: éxito en tests de Python, Node financiero (sin servicios), compilación y referencias locales.
- Inspección de tablas y avisos Supabase; no hubo mutaciones.

## Impedimentos de aprobación
No existe staging aislado y no se han probado operaciones reales de cuenta, pedidos, archivos, pagos ni retiros. No desplegar ni conectar navegador de pruebas al proyecto de producción. Configurar entorno aislado y ejecutar una matriz de roles y RLS antes de cambiar políticas o funciones.

## Auditoría de las tres funciones privilegiadas (lectura directa de PostgreSQL)
- `es_admin()` comprueba `perfiles.id = auth.uid()` y `rol = 'admin'`, y tiene `search_path` fijado.
- `es_vendedor()` comprueba `perfiles.id = auth.uid()` y roles vendedor o admin; también fija `search_path`, pero se recomienda mantener el endurecimiento y calificación de objetos en el plan de seguridad.
- `tembora_admin_cambiar_rol(uuid,text)` rechaza ausencia de sesión, exige que el llamante sea admin leyendo su fila y bloqueándola, valida el rol, impide modificar el propio rol y lanza error si no existe el destino. Usa `search_path` vacío y nombres de tablas calificados.
- Se confirmó con consulta de privilegios de columnas que `authenticated` tiene permiso UPDATE solo en `avatar_url`, `bio` y `nombre_completo` de `public.perfiles`, y no en `rol`.
- **Conclusión preliminar:** los tres avisos son compatibles con un diseño intencional de autorización; no se observó escalada directa por cambiar el campo `rol`. No es una prueba de imposibilidad de abuso y faltan ensayos de acceso con cuentas sintéticas.
- No se cambiaron funciones, políticas, privilegios ni datos reales.

## Revisión de políticas RLS y Storage (22-10-2026)
- `public`: se inspeccionaron políticas para las 11 tablas. Catálogo público solo muestra plantillas con estado publicada; favoritos restringidos a su usuario; pedidos visibles a comprador, vendedor o admin; webs completas visibles al público solo si publicadas. Las políticas de escritura de plantillas y retiro usan condiciones basadas en el rol y propietario. Son observaciones del código de políticas, no pruebas end-to-end.
- `storage.objects`: se revisaron políticas de lectura, inserción, actualización y eliminación para comprobantes, ZIP, imágenes de plantillas, avatares y webs completas. Las subidas de comprobantes usan comprobación de propiedad del pedido; los ZIP de compras exigen pedido verificado y revisión; las imágenes privadas de vendedor pasan por funciones de autorización.
- **Verificación importante:** la política de INSERT `archivos_no_reutilizar` aparece como `RESTRICTIVE` (no `PERMISSIVE`). Su condición de ruta no retirada **restringe** inserciones que primero deben satisfacer alguna política permisiva. Se confirmó mediante `pg_policies.permissive`. No se encontró el bypass de autorización sospechado inicialmente.
- Los permisos `authenticated` sobre `storage.objects` incluyen INSERT, pero la aprobación de cada fila se decide mediante RLS; disponer del privilegio de tabla no implica poder subir cualquier archivo.
- No se alteraron RLS, permisos ni archivos reales. Persisten pruebas pendientes: ensayos de lectura/escritura con roles ficticios, validación negativa de accesos cruzados y control de almacenamiento en staging.
