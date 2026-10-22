# TAVIKU — Fase 7: revisión de seguridad
Fecha: 22-10-2026. Alcance: rama de desarrollo, Supabase Staging `fetoxbjzbteeuzppvxik`; producción intacta.

## Validaciones ejecutadas
- `js/supabase.js`: el cliente contiene una **clave publicable** `sb_publishable_`, no una llave de `service_role`; la clave publicable es apta para navegador. URL del proyecto de producción conocida; **no conectar frontend público a Staging**.
- Control de navegación por roles en cliente: defensa de interfaz; el control decisivo de datos está en PostgreSQL y sus políticas RLS.
- Bajo `SET LOCAL ROLE anon`, lecturas de pedidos y retiros y ejecución de `es_admin()` rechazadas por falta de privilegios, ejecutado y revertido.
- Bajo `authenticated` con identidades ficticias: comprador no obtuvo privilegios de vendedor/admin, no pudo actualizar `perfiles.rol`, ni cambiar roles mediante la función administrativa. Pruebas revertidas.
- `authenticated` carece de `INSERT` directo sobre pedidos y retiros; las operaciones están canalizadas por RPC autorizadas. No tiene permiso para actualizar la columna `perfiles.rol`.
- Comparación de funciones, restricciones y políticas con producción idéntica (fase 6).

## Riesgos y ajustes que quedan fuera del cierre técnico
1. **Protección de contraseñas filtradas de Supabase Auth:** asesor de producción la detectó desactivada. Debe activarse en la configuración de Auth cuando esté disponible; no se encontró una acción de configuración por el conector actual. No afirmar que se corrigió.
2. Avisos de asesores sobre `SECURITY DEFINER` invocables por `authenticated` (`es_admin`, `es_vendedor`, `tembora_admin_cambiar_rol`): permisos intencionados; requieren mantener comprobaciones internas y tests de abuso en fase 9.
3. `tembora_private.archivos_retirados` tiene RLS sin políticas, concebido como tabla interna; documentar y conservar aislamiento.
4. GitHub Pages limita la posibilidad de imponer cabeceras HTTP de seguridad del servidor sin cambiar hosting/CDN. Auditoría completa de cada archivo JavaScript y política CSP no realizada; no afirmar ausencia de vulnerabilidades.
5. Pruebas negativas end-to-end de carga/descarga de Storage, comprobantes y retiros con tokens HTTP reales pertenecen a fase 9. Un test SQL no las sustituye.

## Cierre
**Fase 7 cerrada como auditoría de permisos básicos y delimitación de riesgos, con acciones de endurecimiento pendientes.** No certificación de seguridad integral ni autorización para fusionar `main`. En la fase 9 se debe verificar el comportamiento real con autenticación, compras, almacenamiento y retiros.

Referencia: `docs/FASE6-CIERRE.md`, `tests/staging_role_smoke.sql`.
