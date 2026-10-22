# TAVIKU — Fase 7: seguridad (avance)
Fecha: 22-10-2026. Todas las pruebas SQL se ejecutaron en **TAVIKU Staging** (`fetoxbjzbteeuzppvxik`) con transacciones `ROLLBACK`.

## Verificado
- Funciones `SECURITY DEFINER`: `anon` no puede invocar `es_admin`, `es_vendedor` ni las RPC administrativas. `authenticated` tiene permisos previstos para invocación condicionada; la autorización dentro del cuerpo sigue siendo indispensable.
- Caso de comprador ficticio: no pudo escalar a vendedor/admin ni cambiar directamente `public.perfiles.rol`; la RPC de cambio de rol rechazó la llamada sin permisos. Perfil de vendedor público visible conforme a política.
- Se confirma réplica estructural de fase 6. Ninguna escritura de pruebas en producción.

## Pendientes de fase 7
- Auditoría de JS público para secretos y abuso de parámetros, sesiones y enlaces externos.
- Revisar la configuración Auth de protección contra contraseñas filtradas (aviso documentado en producción).
- Ejecución de casos negativos de Storage y pagos en el entorno de pruebas.
- Revisar el impacto de cabeceras de seguridad en GitHub Pages y políticas CSP.

No fusionar a producción hasta verificar los ajustes y la fase 9.
