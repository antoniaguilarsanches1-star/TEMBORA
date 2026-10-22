# TAVIKU — Fase 6: réplica técnica de backend verificada
Fecha: 22 octubre 2026. Producción: `fhowcuxyokkrbttgyrwy`. Pruebas aisladas: `fetoxbjzbteeuzppvxik`.

## Trabajo completado y validado
Se reconstruyeron los objetos de TAVIKU sobre Supabase Staging sin copiar datos personales ni pedidos. Comparaciones directas producción ↔ Staging:
- 12 tablas (11 públicas y 1 privada), 108 columnas con **huella de esquema idéntica**.
- 62 restricciones con definición y huella **idénticas**.
- 36 índices con definición y huella **idénticas**.
- 35 funciones con código y huella **idénticos**.
- 32 políticas RLS públicas y 16 de Storage con definición y huella **idénticas**.
- 8 disparadores personalizados (incluido el de creación de perfiles al registrar usuarios).
- 5 buckets con configuración copiada; ningún fichero o comprobante real.
- Privilegios de tablas y ejecución de funciones ajustados para usuarios anónimos/autenticados; UPDATE del perfil solo en campos autorizados.
- Revisión con el asesor de seguridad de Supabase realizada. Conserva avisos conocidos de funciones SECURITY DEFINER intencionales y tabla privada sin política, como producción.

## Pruebas ejecutadas
- En una transacción que termina en `ROLLBACK` se crearon 3 usuarios ficticios y se verificó la creación automática de perfiles.
- Mediante `SET LOCAL ROLE authenticated` se simuló el JWT de comprador y administrador: comprador no obtuvo permisos de admin/vendedor, no pudo leer perfiles privados de terceros ni cambiar el rol de otro usuario; administrador sí pudo leer los 3 perfiles.
- El SQL reproducible está en `tests/staging_role_smoke.sql`. Las identidades de prueba se eliminaron al revertir la transacción.
- Los tests previos de balance monetario sin servicios reales y build frontend en GitHub Actions completaron satisfactoriamente (ejecución 39820301791).

## Separación y seguridad
No se cambió producción ni el repositorio `main`. `barberia-black-crown` sigue pausada mientras se usa su espacio gratuito. Staging no contiene usuarios ni datos reales; no se conectó el frontend público.

## Lo que se comprobará en la fase 9
Las pruebas integrales HTTP/Storage con cuentas autenticadas, compras simuladas, cargas de comprobantes, aprobaciones y retiros, más regresión de navegación y diseño en equipos, **aún no se han ejecutado**. Los resultados de pruebas RLS vía SQL no equivalen a una batería end-to-end.

## Importante: historial de migraciones
Staging se reconstruyó desde las definiciones actuales del catálogo de PostgreSQL y migraciones pequeñas, **no** reproduciendo las 13 migraciones originales de producción. Aunque las huellas actuales coinciden, los historiales de migraciones son distintos. **No fusionar ni aplicar las migraciones de staging a producción**. Antes de modificar producción, crear migraciones de cambio revisadas y compatibles con su historial original, con backup y autorización.

**Resultado de fase 6:** réplica técnica y pruebas estructurales/roles mínimas completadas; los flujos funcionales de negocio quedan explícitamente reservados a la fase 9.
