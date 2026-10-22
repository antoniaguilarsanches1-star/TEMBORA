# TAVIKU — Fase 9: pruebas funcionales (avance validado)
Fecha: 22 octubre 2026. Solo desarrollo y Supabase Staging.

## Pruebas automatizadas aprobadas
- Incorporada al workflow `.github/workflows/verificar-desarrollo.yml` la ejecución `node --test tests/phase9-marketplace.test.cjs`.
- GitHub Actions ejecución [39843413022](https://github.com/antoniaguilarsanches1-star/TEMBORA/actions/runs/39843413022) (commit `6cd51a02be915a5e35a9d6735aa550d95c407e0d`): **completed/success**. El paso «Probar permisos y saldos del marketplace» terminó correctamente, al igual que las pruebas financieras previas, build y validación estática.
- Se comprobaron con mocks restricciones de roles de comprador, vendedor y administrador, junto al cálculo de saldo monetario.

## Pruebas de Supabase Staging
- La conexión SQL volvió a funcionar.
- En una transacción `ROLLBACK`, comprador ficticio no logró comprar un identificador de plantilla inexistente ni solicitar un retiro Yape sin rol/saldo apropiado; tampoco vio pedidos ajenos. Tras la transacción no quedaron operaciones.
- Pruebas de control de acceso previas de fase 6-7 continúan documentadas.

## Pendiente para declarar cierre integral
- Pruebas end-to-end con autenticación real (no solo roles JWT simulados), pedidos sobre plantillas ficticias publicadas, confirmación del pago, descarga de ZIP, almacenamiento de comprobantes, retiro de vendedor con al menos S/50 y sus estados.
- Recorrido en navegador de compra, venta, administración y «Creamos tu página» en PC y móvil.
- Lighthouse y revisión visual final.

**Estado: en curso; no declarar fase 9 terminada ni permitir publicar todavía.** Producción y dinero real intactos.
