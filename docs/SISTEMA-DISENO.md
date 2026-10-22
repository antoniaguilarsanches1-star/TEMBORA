# TAVIKU — Sistema de diseño, fase 3

## Criterio
Un solo sistema visual coherente para todas las páginas públicas y privadas. Las ramas comerciales son iguales en importancia: Marketplace (azul `#2563EB`) y Creamos tu página (verde azulado `#0D9488`). El color no indica autorización ni sustituye etiquetas.

## Fuente de verdad
Los tokens compartidos residen en `css/styles.css` dentro de `:root`. Incluyen paletas, tipografía Inter con alternativas, ancho de contenido, ancho de encabezado, escalas de espacios, bordes y sombras existentes. Los módulos no deben redefinirlos sin razón documentada. `css/pillars.css` reutiliza el token de ancho del encabezado.

## Componentes existentes
- `components/header.html`: encabezado de todas las páginas, generado por `scripts/build_site.py`.
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-sm` y `.btn-lg` en `css/styles.css`.
- Contenedor global `.container` y propiedades de texto establecidas en `css/styles.css`.
- Formularios, tarjetas y paneles especializados permanecen en sus CSS de módulo mientras se inventarían sus dependencias.
- Los estados de cuenta se rigen por `js/supabase.js`, nunca por el color o el diseño del botón.

## Accesibilidad y mantenimiento
Se añadió foco visible por teclado a enlaces, controles y elementos enfocados; se respeta `prefers-reduced-motion`. En fase 4 se comprobará navegación por teclado, zoom, contraste, móvil y tablet.

## Reglas para futuros cambios
1. Corregir primero el componente o token compartido, no parchear cada página.
2. No crear otra regla de encabezado específica de una página sin justificarla.
3. No hacer cambios visuales sensibles a sesión sin pruebas de visitante, comprador, vendedor y administrador.
4. No quitar CSS antiguo hasta comprobar que ninguna vista lo necesita.
5. No integrar la rama en `main` hasta pruebas de navegador y aprobación.

## Verificación
GitHub Actions ejecuta las pruebas del generador y revisa recursos locales. El sistema de diseño necesita aún comparación visual automática o manual de vistas representativas para considerarse plenamente aprobado, especialmente con las cuentas reales sustituidas por un entorno aislado.
