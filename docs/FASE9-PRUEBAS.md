# TAVIKU — Fase 9: pruebas funcionales (en curso)
Fecha: 22 octubre 2026. Sin cambios en la rama de producción ni operaciones monetarias reales.

## Avance
- Añadido `tests/phase9-marketplace.test.cjs` con 6 pruebas aisladas usando la función de inyección de dependencias ya presente en `js/mercado-api.js` y `js/pagos-api.js`.
- Pruebas previstas: comprador rechazado en sección de vendedor y listado de usuarios, administrador impedido de modificar su propio rol o asignar roles inesperados, vendedor rechazado en listado de pedidos de administrador, y balance financiero con retiros pendientes/aprobados/pagados.
- Ejecutar con `node --test tests/phase9-marketplace.test.cjs`. Este archivo se ha guardado, pero **no debe considerarse aprobado hasta que se ejecute y el resultado confirme éxito**.
- Supabase Staging existe con réplica técnica verificada en fase 6, pero en esta sesión las consultas de inspección mediante el conector fueron bloqueadas por controles de seguridad; no se han podido ejecutar nuevos flujos de RPC, Storage ni Auth.
- La ejecución previa de pruebas de tres perfiles con rollback se documenta en `docs/FASE6-CIERRE.md`.

## Falta para cerrar fase 9
Ejecutar tests Node en CI; crear y probar identidades reales solo en Staging con OAuth/Auth real; pruebas de compra, comprobantes, revisión, entrega ZIP y retiro S/50; pruebas de búsqueda, venta, solicitud de web y regresión visual en navegador móvil y escritorio. No afirmar que son funcionales sin ejecutarlas.
