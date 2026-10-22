# TAVIKU — Arquitectura y migración

## Alcance
TAVIKU integra Marketplace y Creamos tu página con la misma importancia. Los roles son visitante, comprador, vendedor y administrador. La autorización de datos permanece en Supabase y sus políticas RLS, no en el HTML ni en la visibilidad de botones.

## Un solo encabezado
La fuente canónica es `components/header.html`. Diecinueve páginas fueron migradas del HTML repetido al marcador `<!-- TAVIKU:HEADER -->`. El generador `scripts/build_site.py` inserta el encabezado en `dist/`, que es el resultado estático que debe servirse. No abrir el código fuente HTML marcado directamente ni publicar la rama fuente como GitHub Pages sin compilar.
La lógica existente de `js/supabase.js` decide el destino de Mi Panel según el rol; esta fase preserva ese contrato. Quedan pendientes las pruebas visuales y de estabilidad del encabezado entre las cuatro clases de sesión.

## Dependencias actuales
- `js/app.js`: navegación y utilidades de interfaz.
- `js/supabase.js`: cliente, sesión, control de acceso y controles visuales de cuenta.
- `js/mercado-api.js`: operaciones del Marketplace.
- `js/pagos-api.js`: pedidos, comprobantes, retiros.
- `js/mercado-ui.js`: vista de Marketplace y paneles.
- `js/business.js`: servicios para negocios.

## Migración realizada
- Componente: `components/header.html`.
- Generador: `scripts/build_site.py`.
- Orígenes migrados (19): `index.html`, `catalogo.html`, `pagina-personalizada.html`, `webs-completas.html`, `como-funciona.html`, `login.html`, `registro.html`, `panel-comprador.html`, `panel-vendedor.html`, `admin.html`, `compra.html`, `contacto.html`, `vender-publico.html`, `vender.html`, `terminos.html`, `privacidad.html`, `licencias.html`, `plantilla.html`, `vendedor.html`.
- Flujo automático: `.github/workflows/verificar-desarrollo.yml` construye y comprueba `dist/`, sin empaquetar un sitio que se conectaría a la base de producción.

## Pendientes antes de producción
1. Confirmar que ninguna página adicional mantiene encabezado duplicado; el generador ahora falla ante encabezados antiguos no migrados.
2. Centralizar y probar estilos de navegación y reservar espacio estable para acciones de sesión en escritorio y móvil.
3. Verificar el estado real de GitHub Actions; no se ofrecen artefactos navegables mientras Supabase no esté aislado.
4. Crear URL de previsualización separada: este flujo solo empaqueta HTML, no hospeda la web.
5. Crear base Supabase de pruebas aislada antes de pruebas de compras, comprobantes y retiros.
6. Ejecutar pruebas funcionales, responsive, accesibilidad y regresión para todas las páginas.
7. Consolidar estilos antiguos sin romper componentes; eliminar únicamente después de medir dependencias.
8. Revisar y aprobar explícitamente la integración a `main`.

## Regla de publicación
La rama `main` sigue siendo producción. El contenido fuente con marcadores **no** debe publicarse allí hasta configurar la compilación y completar pruebas. El paquete generado `dist/` es el candidato a despliegue posterior, no una versión aprobada aún.

## Verificaciones del cierre técnico (22-10-2026)
- Se verificó mediante lectura del repositorio que los 19 HTML inventariados usan exactamente un marcador de encabezado.
- El comprobador estático se ejecuta sobre `dist/` y falla si faltan archivos o recursos locales; la comprobación está configurada, pero no se ha confirmado una ejecución exitosa de GitHub Actions.
- El HTML generado aún debe superar pruebas visuales y funcionales con roles, dispositivos y sesión.
- No existe una URL de pruebas independientes ni un Supabase aislado confirmado. Estas son condiciones para aprobar el paso a producción; no se deben simular pagos con datos reales.
- No se ha fusionado nada con `main`.
