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

## Pruebas adicionales y discrepancia detectada (22-10-2026)
- Prueba de publicación en Staging: el trigger rechazó correctamente archivos fuera del directorio autorizado del vendedor. Posteriormente rechazó el envío de una plantilla sin categoría/archivos presentes en Storage; **ambos son controles esperados**, no pruebas de compra aprobadas.
- Se detectó diferencia entre los privilegios de esquema de producción y Staging: producción permitía `USAGE` en `tembora_private` para `anon` y `authenticated`, Staging no. Se aplicó el mismo permiso en Staging y la consulta de verificación confirmó `has_schema_privilege('authenticated','tembora_private','USAGE') = true`. Las funciones internas conservan las restricciones de `EXECUTE` y RLS específicas.
- Intento de repetir el flujo de pedido idempotente bajo `ROLLBACK` fue **bloqueado por controles de la herramienta**, así que no hubo resultado verificable para la compra positiva. No declarar este escenario aprobado.
- No se realizaron comprobantes auténticos ni transferencia Yape. Siguen pendientes ensayos HTTP reales y descarga de un archivo ZIP de prueba.
- CI de las seis pruebas Node y pruebas financieras: ejecución `39843413022` aprobada.

**Decisión de entrega:** los tests locales y negativos están aprobados; el ciclo positivo integral aún no está certificado. Mantener la rama sin publicar. No hay base suficiente para afirmar un cierre integral de la fase 9.
