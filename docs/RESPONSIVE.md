# TAVIKU — Fase 4: Responsive

## Cambios implementados
- Menú móvil y de escritorio alineados a un mismo límite: hasta 1360px aparece el botón; desde 1361px se muestra la navegación horizontal.
- El cierre del menú depende de su visibilidad CSS real en vez de una cifra rígida en JavaScript.
- Se restringe el ancho mínimo de encabezado, botones y tarjetas para evitar desbordes habituales en teléfonos.
- Se mantienen las reglas especiales ya aprobadas para tipografía y presentación de TAVIKU, sin rediseñar el contenido.
- Pruebas de contrato en `tests/test_responsive.py`.

## Matriz que debe verificarse en navegador antes de publicación

| Ancho | Pruebas |
| --- | --- |
| 320px | Encabezado, botones de acceso, menú desplegado, sin desplazamiento lateral |
| 375px y 390px | Acciones de cuenta, enlaces largos, tarjetas y formularios |
| 480px y 700px | Cambio de columnas, posición de acciones y menú |
| 768px y 1024px | Menú táctil, paneles comprador/vendedor/administrador |
| 1360px y 1361px | Cambio exacto entre hamburguesa y navegación horizontal |
| 1440px y 1920px | Espacios, encabezado, grid y legibilidad |

Verificar visitante, comprador, vendedor y administrador; estados de carga y error de sesión; pestañas, tablas, formularios, comprobantes, modales, cartera y cotizaciones. Incluir navegación por teclado y orientación horizontal.

## Límite de verificación
La comprobación automática de Python puede demostrar integridad estructural y evitar regresiones de reglas CSS/JS, pero no es equivalente a una captura o prueba de navegador en dispositivo real. Hasta realizar la matriz anterior no se puede declarar el diseño responsive validado al 100%. La web pública en `main` permanece sin cambios y la rama de desarrollo no debe conectarse a cuentas de pruebas que escriban sobre Supabase de producción.
