# TAVIKU — Fase 5: contratos del frontend

## Alcance
Se inspeccionaron `js/public.js`, `js/app.js`, `js/supabase.js`, `js/mercado-ui.js`, `js/mercado-api.js` y `js/business.js`.

## Correcciones
- Se retiró de `js/public.js` un segundo conjunto de eventos para el menú móvil: el propietario único es `initNavigation()` en `js/app.js`. Evita escuchas duplicadas de clic y teclado.
- Se protegen elementos opcionales de formularios, página de contacto, recarga del catálogo y registro de vendedores frente a valores nulos.
- Se incorporó `tests/test_frontend_contracts.py` con comprobaciones sin sesiones, sin cuentas de prueba y sin operaciones contra Supabase.
- Se preservaron roles, compras, pagos y API existentes.

## Pruebas aún necesarias antes de publicar
Flujos de invitado, comprador, vendedor y administrador; favoritos, búsquedas, detalles, descargas, compras, carga de plantillas, moderación, retiros, solicitudes de negocios y manejo de errores. Para probar escrituras se requiere Supabase aislado y datos sintéticos. Las pruebas de contrato no sustituyen estas pruebas end-to-end.

## Seguridad de despliegue
El código permanece en la rama `desarrollo-arquitectura-taviku`; no fusionar con `main` hasta pruebas de regresión y revisión final.

## Revisión adicional
En `js/business.js` se protegieron controles opcionales de la galería y el formulario de solicitud: botón de reintento, etiqueta de estado y lista de selección de modelos. Evita errores de JavaScript si una plantilla HTML no incluye alguno de esos nodos. Se añadieron contratos de regresión en `tests/test_frontend_contracts.py`. La revisión no escribe en Supabase.
