# Limpieza final de TAVIKU — 4 de octubre de 2026

Estado inicial: `61a3d69`, sin cambios locales. Trabajo sobre ese estado, sin reescribir commits ni publicar cambios.

## Correcciones

- Admin, panel vendedor y publicación usan el mismo menú de siete enlaces que las páginas públicas. Se conserva la navegación interna y sus estados activos.
- Contacto ofrece siete asuntos para ambos pilares, con «Web completa» y «Soporte». El enlace de soporte del footer selecciona ahora «Soporte»; la FAQ usa ese mismo nombre.
- Las descripciones de Contacto y Cómo funciona representan ambos pilares. La descripción de Mi pedido corresponde a esa vista.
- Sitemap: se sustituye `vender.html` por `vender-publico.html` y se retiran login y registro. Contiene las siete páginas comerciales y los tres documentos legales, conservando dominio y `/TEMBORA/`.
- Admin, comprador, vendedor, pedido y publicación incluyen `noindex, nofollow`.
- El WhatsApp flotante de Inicio conserva su enlace nativo y evita abrir una segunda ventana mediante JavaScript. Se actualiza la versión del recurso en Inicio y la del script público en Contacto.

## Inspección y elementos conservados

- Los 19 footers existentes ya coincidían y representan Plantillas y Para negocios. No se reescribieron.
- Los enlaces y recursos locales de todos los HTML existen. La recuperación de contraseña usa un formulario generado por el módulo de autenticación; se comprobó también en navegador.
- Las vistas privadas ya carecían de WhatsApp flotante. Los botones Actualizar y sus mecanismos de recuperación se conservan.
- Inicio, catálogo, Para negocios y Webs completas conservan diseño, formularios, filtros, planes y flujos. No se detectó desbordamiento global en los tamaños probados; no fue necesario cambiar CSS.
- Se conservaron los documentos legales: la licencia trata las plantillas y privacidad ya contempla consultas/cotizaciones. No se añadieron obligaciones sobre futuros sistemas de negocios.
- Sin cambios en autenticación, OAuth, roles, APIs de marketplace/pagos, lógica de las cuentas, comisión 80/20, descargas, comprobantes, auditoría, RLS, RPC ni archivos de Supabase.
- No se eliminaron archivos: no se confirmó código muerto cuya eliminación justificara el riesgo. Se mantienen identificadores internos y rutas existentes.

## Verificación

Regresión de los 16 archivos de pruebas, incluido el nuevo control de limpieza: **175 comprobaciones aprobadas**, contando suites y subpruebas. Se realizó un recorrido completo de la suite en bloques y se repitieron únicamente los controles afectados.

- Público: navegación, footer, catálogo, filtros, categorías, favoritos desde detalle, formularios, FAQ, login, registro, recuperación y OAuth simulados.
- Webs completas: visibilidad pública, demo configurada, selección de modelo, solicitud y gestión Admin (crear, editar, publicar, ocultar y ordenar).
- Comprador: pedido, comprobante, rechazo, corrección, aprobación, descarga autorizada, historial y perfil.
- Vendedor: publicación, revisión, rechazo, corrección, reenvío, ventas, retiros y perfil; Admin: revisión, pagos, retiros, Yape, usuarios y perfil.
- APIs: permisos, validaciones, archivos privados, idempotencia, recuperación tras errores y saldo/retiros.
- Responsive: siete páginas principales a 1440, 1024, 390 y 320 px; otras páginas públicas a 390 px; comprador, vendedor y Admin en móvil y escritorio. Inspección visual de capturas de Inicio, Contacto, Para negocios, vendedor y Admin.
- Auditoría de enlaces/recursos locales, sitemap, ausencia de navegación antigua, footers y asuntos de contacto.
- Sintaxis de los dos scripts modificados y `git diff --check`: correctos.

Durante la verificación se corrigieron comprobaciones antiguas: una espera del catálogo se ejecutaba antes de finalizar la navegación; las comparaciones de alcance necesitaban admitir los cambios de metadatos y la referencia de Supabase del estado inicial actual. Se limitaron las esperas del recorrido comprador. Las pruebas funcionales no se eliminaron ni se omitieron.

Los recorridos de navegador utilizaron backend y recursos externos simulados. No se hicieron pagos, transferencias, escrituras en producción, envíos de WhatsApp ni correos reales. No se volvió a ejecutar SQL ni se verificó disponibilidad de demos externas reales. Las capturas no validan la carga de fuentes o iconos externos, que el simulador intercepta.

## Archivos

HTML: `admin.html`, `como-funciona.html`, `compra.html`, `contacto.html`, `index.html`, `panel-comprador.html`, `panel-vendedor.html`, `vender.html`.

Otros: `js/app.js`, `js/public.js`, `sitemap.xml`.

Pruebas: `tests/comprador-alcance.test.cjs`, `tests/comprador-pagos-final.test.cjs`, `tests/publico-final.test.cjs`, `tests/vendedor-revision-final.test.cjs` y el nuevo `tests/limpieza-final.test.cjs`.

Informe nuevo: `LIMPIEZA-FINAL.md`. Archivos eliminados: ninguno.

## Futuro, sin implementar

Tratar el sistema operativo de negocios como una etapa independiente y ampliar sus condiciones cuando se defina el servicio funcional. Al publicar esta limpieza, realizar una comprobación breve del sitio real, OAuth, recursos externos y demos configuradas. No se ha hecho push.

## Cierre actualizado — 6 de octubre de 2026

TAVIKU queda definido y cerrado como plataforma de **dos ramas**:

1. **Plantillas**: marketplace con comprador, vendedor y administrador, pagos por Yape, revisión de comprobantes, descarga privada del ZIP y retiros del vendedor.
2. **Webs completas**: galería de modelos de negocio, demo pública, solicitud por WhatsApp y gestión administrativa de los modelos.

### Cambios finales aplicados

- Se reforzó Supabase con políticas RLS optimizadas, eliminación de una política antigua de creación de pedidos, permisos estructurales reducidos e índices faltantes.
- Se limitó la lectura pública de perfiles a vendedores y se separó el acceso público/autenticado de plantillas y webs completas.
- Las funciones internas de trigger dejaron de ser invocables desde la API pública.
- actualizar_fecha() usa un search_path fijo.
- La ficha de Webs completas muestra hasta siete funciones inicialmente y permite desplegar el resto.
- La portada y la vista del panel administrativo se compactaron para reducir scroll.
- El panel de una Web completa usa **una sola captura administrativa**, tanto en el formulario de Admin como en la restricción de base de datos.
- Black Crown Barbería permanece publicada como la primera Web completa.

### Estado de datos revisado

En producción se encontraron 5 perfiles, 4 plantillas publicadas, 3 pedidos verificados, 2 retiros y 1 Web completa publicada. No se eliminaron porque no existe una señal segura que permita distinguir cuáles son datos de prueba y cuáles deben conservarse.

### Avisos de Supabase que permanecen

- es_admin(), es_vendedor() y tembora_admin_cambiar_rol(...) siguen apareciendo como funciones SECURITY DEFINER ejecutables por usuarios autenticados. Se conservan porque forman parte de las comprobaciones internas de autorización; la función de cambio de rol valida además que el actor sea administrador.
- tembora_private.archivos_retirados tiene RLS sin políticas públicas. Es una tabla interna y no se abrió acceso.
- La protección de contraseñas filtradas de Supabase Auth sigue pendiente de activación manual desde el panel de Supabase.
- Los índices recién creados aparecen como no usados hasta que exista tráfico suficiente; no es un fallo funcional.

No se añaden nuevas funciones al producto durante este cierre.
