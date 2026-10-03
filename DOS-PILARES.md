# Actualización TAVIKU — 3 de octubre de 2026

## Resultado

Plantillas web y creación de páginas para negocios se presentan con igual importancia. Se conserva el catálogo y la lógica existente de usuarios, compras, pagos, descargas y retiros.

## Páginas y archivos

- `index.html`: hero general, dos caminos equivalentes, buscador en categorías, bloque de negocios, cuatro beneficios y dos CTA finales.
- `pagina-personalizada.html`: Para negocios conserva la URL existente; incluye beneficios, rubros, funciones, tres planes sin precio definitivo, QR, reservas, acceso desde pantalla de inicio, proceso, FAQ y solicitud.
- **Nueva `webs-completas.html`**: galería dinámica, demo externa y selección automática del modelo en el formulario de la misma página.
- `como-funciona.html`: compradores y vendedores agrupados bajo Plantillas web, proceso Para negocios y FAQ separadas.
- `catalogo.html`: nuevo subtítulo; catálogo, filtros y tarjetas conservados.
- `vender-publico.html`: pasos y texto solicitados; conserva 80%, mínimo S/50 y retiros por Yape.
- `contacto.html`: Soporte TAVIKU, siete asuntos, FAQ para ambos pilares y CTA compacta.
- `admin.html`: sección independiente de gestión de modelos; crear, editar, cambiar portada, funciones, demo, estado y posición.
- `login.html`: se recupera el enlace visible “¿Olvidaste tu contraseña?”, conectado al flujo existente sin alterar su lógica.
- Navegación y footer compartidos también en `compra.html`, `panel-comprador.html`, `panel-vendedor.html`, `plantilla.html`, `vendedor.html`, `vender.html`, `registro.html`, `terminos.html`, `privacidad.html` y `licencias.html`.
- `css/pillars.css`: estilos compactos y responsive compartidos.
- `js/business.js`: solicitudes por WhatsApp, galería y editor Admin. Renderiza los datos como texto; valida demos HTTPS y archivos de portada.
- `js/public.js`: adapta la preselección del asunto de soporte.
- `sitemap.xml` y `README.md`: nueva página y documentación.
- `tests/dos-pilares.test.cjs`, `tests/publico-final.test.cjs`: cobertura de los nuevos flujos y expectativas públicas actualizadas.
- `tests/comprador-pagos-final.test.cjs`: prueba preexistente sin seguimiento; se ajustaron las expectativas del menú, el filtro del simulador y la espera de confirmación de favoritos.

## Navegación

Inicio · Plantillas · Para negocios · Webs completas · Cómo funciona · Vender · Contacto. Se conservan Iniciar sesión y Registrarse y el comportamiento por sesión existente.

## Supabase y Admin

Aplicado `supabase/sql/webs-completas.sql` en PlantillaPE: tabla `public.webs_completas`, índice de orden, RLS y bucket privado `webs-completas`. No modifica tablas, funciones ni políticas del marketplace. Reutiliza la comprobación de administrador existente.

Admin puede crear y editar; los demás roles solo leen publicaciones. Estados: Borrador, Publicada y Oculta. Publicar exige portada, demo HTTPS y funciones. Las portadas admiten JPG, PNG y WebP hasta 5 MB. Se generan enlaces temporales de 10 minutos; una portada previamente enlazada puede seguir visible hasta su vencimiento después de ocultarla.

La galería no contiene modelos inventados. Deben cargarse las portadas y demos reales desde Admin. Las solicitudes se preparan en WhatsApp y el visitante confirma el envío allí. No se implementó compra automática ni almacenamiento nuevo de solicitudes.

## Verificación

- 67 pruebas de API e interfaz de marketplace y pagos: aprobadas.
- 85 pruebas de páginas públicas, publicación de plantillas, vendedores, OAuth y retiros: aprobadas.
- 8 pruebas de carga y autenticación: aprobadas.
- 6 pruebas de la nueva sección (incluido el contenedor de pruebas): aprobadas. Incluyen demo configurada, selección automática, formulario, crear/editar/publicar/ocultar/ordenar, recuperación y responsive.
- 1 recorrido comprador completo: aprobado, con backend simulado y sin pagos reales.
- Pruebas SQL reales con rollback: público, comprador, vendedor, Admin, restricciones de escritura y visibilidad de portadas publicadas/ocultas. No quedan registros de prueba.
- Siete páginas revisadas a 1440, 1024, 390 y 320 px; sin desbordamiento horizontal. Capturas de escritorio y móvil; inspección visual de Inicio y Para negocios.
- Sintaxis de `js/business.js` y comprobación de espacios de Git: aprobadas.
- Verificación adicional de una copia exacta del índice de Git, sin los cambios locales previos: 6 pruebas de la nueva sección y 9 de páginas públicas aprobadas. Se comprobó que el bloque a confirmar funciona de forma independiente.

Las pruebas de navegador utilizan datos simulados; no enviaron mensajes, correos ni pagos, y no iniciaron sesión con cuentas reales. La autorización se verificó además directamente en PostgreSQL. No se afirma una prueba de entrega real de correo o WhatsApp.

## Hallazgos

- Faltaba el enlace visible de recuperación en el login; corregido usando la función existente.
- Las pruebas antiguas esperaban el menú y asuntos anteriores; actualizadas. El simulador de comprador no implementaba el filtro de revisión de Admin y navegaba antes de confirmar favoritos; corregido solo en pruebas.
- El asesor de Supabase reporta avisos sobre funciones y configuración de autenticación preexistentes, fuera de este alcance. Ninguno menciona la nueva tabla o sus políticas. No se alteraron esas funciones ni la configuración de Auth.
- Había cambios locales previos sin commit. Se conservan; el commit de esta actualización separa las modificaciones de navegación de los cambios anteriores de cuentas, lógica del marketplace y textos legales.
