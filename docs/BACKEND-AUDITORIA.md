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
