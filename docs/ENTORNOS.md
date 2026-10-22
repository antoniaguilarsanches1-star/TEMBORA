# TAVIKU — Entornos de trabajo

## Producción
- Repositorio: antoniaguilarsanches1-star/TEMBORA
- Rama: `main`.
- Publicación actual: GitHub Pages.
- Base de datos: Supabase PlantillaPE, proyecto `fhowcuxyokkrbttgyrwy`.
- **Prohibido** hacer pruebas de compra, retiro, modificación de roles o subida de comprobantes con datos reales.

## Desarrollo
- Rama: `desarrollo-arquitectura-taviku`.
- Los cambios de arquitectura se introducen y verifican aquí, sin modificar `main`.
- La comprobación automatizada `verificar-desarrollo.yml` comprueba archivos básicos y empaqueta el sitio en un artifact descargable llamado `taviku-preview-estatico`.
- **Advertencia:** el paquete no es una URL de vista previa pública ni equivale a una prueba funcional completa.

## Vista previa web pendiente
GitHub Pages de este mismo repositorio NO debe reconfigurarse para servir la rama de desarrollo: podría reemplazar la web pública. La futura URL de pruebas debe usar hospedaje separado y una configuración que impida operaciones reales.

## Supabase para pruebas pendiente
Antes de probar autenticación, pagos, retiros, permisos o Storage, configurar un proyecto Supabase separado con migraciones comprobadas y datos ficticios. Nunca colocar claves secretas o service_role en el frontend.

## Proceso de cambios
1. Cambiar exclusivamente la rama de desarrollo.
2. Revisar archivos y ejecutar comprobaciones automáticas.
3. Comprobar manualmente en escritorio/móvil y con visitante, comprador, vendedor y admin, usando entorno aislado.
4. Registrar las pruebas y los archivos antiguos reemplazados.
5. Integrar a `main` únicamente una versión aprobada y reversible.

## Regla de limpieza
No eliminar archivos, rutas, estilos o funciones anteriores hasta verificar que ninguna página o módulo depende de ellos. Git conserva el historial, pero el código de producción no debe acumular implementaciones obsoletas.
