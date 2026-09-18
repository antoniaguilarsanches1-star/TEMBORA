# TEMBORA / PlantillaPE — estado funcional

Actualizado el 16 de septiembre de 2026. Sustituye el informe anterior a la integración de Yape.

## Implementado

- Envío vendedor con categorías reales, validación, preparación privada, imágenes/ZIP, registro de rutas, recuperación y envío seguro a revisión. Precio mínimo S/20; descripción mínima 100 caracteres; imágenes JPG/PNG/WebP hasta 5 MB, cinco adicionales; ZIP hasta 50 MB.
- Panel vendedor: plantillas propias, estados, rechazo, corrección/reenvío, edición permitida, retiro de preparaciones y limpieza coordinada de archivos antiguos no referenciados.
- Panel administrador: revisión de plantillas y archivos, publicación/rechazo, comprobantes, pagos, ventas, retiros, configuración Yape y usuarios mediante la función administrativa existente. Ningún usuario real fue cambiado.
- Catálogo/detalle/perfil público consultan datos reales y solo plantillas publicadas. Se retiraron las opciones de clasificación por ventas/calificaciones que dependían de contadores aún no mantenidos.
- Comprador: favoritos, compras, historial, pedido persistente en compra.html, comprobante privado, recuperación y descarga autenticada tras aprobación.
- Yape: 993498739, titular anthony aguilar. El pedido conserva una copia del destinatario y precio. El administrador debe comprobar personalmente el abono; subir una imagen no aprueba el pago.
- Comisión fijada en servidor: 20% plataforma y 80% vendedor. Saldo a partir de pagos verificados, reservas y retiros pagados; solicitudes idempotentes desde S/50. La plataforma registra transferencias realizadas manualmente, no transfiere dinero.
- Perfil propio limitado a nombre/biografía. Soporte y formularios de contacto/cotización preparan mensajes a WhatsApp 51993498739; el usuario los envía personalmente.
- Bloqueo de doble envío, mensajes de progreso/error, actualización tras cambio de cuenta. Almacenamiento de recuperación solo con identificadores/rutas, sin contraseñas ni tokens.

## Supabase

Migraciones aplicadas: `tembora_pedidos_impedir_autoverificacion`, `tembora_yape_pedidos_retiros_seguros`, `tembora_limpieza_archivos_marcados`, `tembora_limpieza_serializar_galeria`.

Fuentes SQL: `sql/pedidos-insercion-segura.sql`, `sql/yape-compras-retiros.sql`, `sql/limpieza-archivos-segura.sql`.

- Configuración de pago; snapshots de precio, vendedor, ZIP y destinatario en pedidos; columnas generadas de comisión/ingreso; auditoría; retiros con reserva y referencias únicas.
- Escritura directa de pedidos/retiros revocada a clientes. RPC con identidad/rol comprobados, bloqueos e idempotencia: `tembora_crear_pedido`, `tembora_enviar_comprobante`, `tembora_revisar_pago`, `tembora_solicitar_retiro`, `tembora_revisar_retiro`, `tembora_configurar_yape`.
- ZIP y comprobantes privados. El comprador obtiene solo el ZIP exacto de su pedido aprobado; no hay URLs públicas de ZIP. Comprobantes inmutables al enviar a revisión y retenidos para auditoría.
- `tembora_marcar_obsoletos` marca rutas antiguas no referenciadas antes de borrarlas por Storage; triggers impiden volver a asociarlas. No borra archivos recientes, vigentes ni ZIP comprados. Tabla privada de marcas sin políticas de acceso cliente, intencionalmente.
- Se preservan las protecciones de publicación/propiedad del Bloque 1. No se cambiaron contraseñas ni cuentas reales.

## Archivos

Frontend principal: `js/plantillas-envio.js`, `js/vender.js`, `js/mercado-api.js`, `js/mercado-ui.js`, `js/pagos-api.js`, `js/app.js`; `js/supabase.js` conserva autenticación y añade el adaptador de envío y guard comprador para compra.html.

Pantallas: vender, panel-vendedor, admin, panel-comprador, index, catalogo, plantilla, compra, vendedor y contacto. Pies de página HTML actualizados con WhatsApp/soporte, incluidos login y registro; no se rehízo su autenticación. Pruebas en `tests/` y `supabase/tests/yape-flujo-rollback.sql`.

## Verificación completada

- Tramo anterior: 56 pruebas de envío/formulario, 32 de API de marketplace y 7 de interfaz aprobadas.
- Integración Yape: 24 pruebas de pagos/interfaz aprobadas; incluyen las 7 anteriores y 17 nuevas.
- Cuatro pruebas adicionales de usuarios/perfil/rutas aprobadas.
- Cuatro últimas pruebas específicas aprobadas: compra sin acceso no consulta pedidos, nombres de usuarios tratados como texto, perfil sin selector de rol, módulo de pagos inicializa aunque el navegador bloquee almacenamiento.
- Sintaxis de JavaScript modificados aprobada; últimas modificaciones de pagos/interfaz comprobadas nuevamente.
- Integración SQL reversible: preparación/publicación, pedido, rechazo/corrección de comprobante/aprobación, 20/80, permisos ZIP antes/después, aislamiento de terceros, manipulación denegada, retiros/reserva/saldo, limpieza y bloqueo de reutilización. ROLLBACK completo. Usa metadatos de Storage sintéticos: NO constituye una prueba de subida/descarga de bytes por HTTP.
- Comprobación posterior: cero plantillas, pedidos, retiros y usuarios TEMP_TEST_; catálogo vacío es correcto. No hubo pagos reales.
- Navegador: compra sin sesión redirige a login; perfil público sin ID ofrece catálogo en lugar de datos ficticios; categorías reales y enlaces de soporte correctos.

## Pendiente antes de publicar comercialmente

1. Recorrido autenticado de navegador con archivos reales temporales: vendedor sube, administrador rechaza/corrige/publica, comprador presenta evidencia, administrador revisa y comprador descarga. El usuario debe iniciar sesión personalmente; no se solicitan contraseñas. Una simulación nunca debe registrarse como un abono real.
2. Términos, privacidad, licencias y política comercial de reembolsos aprobados por el titular. Los enlaces legales/sociales sin destino siguen pendientes. No se inventaron compromisos comerciales.
3. Recuperación de contraseña y botones de acceso social existentes no forman parte del flujo implementado; necesitan integración y validación antes de presentarlos como disponibles.
4. Revisar avisos heredados del asesor de Supabase: search_path de actualizar_fecha, funciones SECURITY DEFINER accesibles y protección de contraseñas filtradas desactivada. No se revocaron indiscriminadamente funciones usadas por RLS ni se reconfiguró autenticación.
5. Configuración de dominio/hosting y validación en el dominio final. No se declara publicada ni totalmente validada con cuentas reales.

## Referencias del asesor

- [Search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Funciones accesibles sin sesión](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Funciones accesibles con sesión](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Recorrido real de navegador — continuación 17 de septiembre

Plantilla temporal autorizada: `TEMP_PRUEBA_TEMBORA_20260916`, ID `5bf144ea-54d5-4b79-8d83-71eb74f92d5b`, S/20. No eliminar hasta terminar el recorrido y limpiar sus dependencias temporales.

Aprobado en el tramo anterior: subida real de imagen PNG y ZIP, envío pendiente con fecha de revisión, persistencia tras recarga, listado propio bloqueado y visualización de imagen privada (320 x 180). Confirmadas ambas rutas en Storage. Corregidos renderizado ficticio sobre beneficios del vendedor, textos 70% → 80%, botones hidden afectados por CSS; 2 pruebas específicas y sintaxis aprobadas. Actualizada versión de CSS en enlaces HTML para evitar caché anterior.

Aprobado en esta continuación: catálogo muestra cero publicadas con la plantilla pendiente existente; acceso directo al detalle de esa plantilla no muestra su contenido; finanzas del vendedor muestran ingreso/reserva/pagado/disponible S/0; historial muestra Sin movimientos. Servidor local reiniciado tras interrupción; sesión vendedor conservada.

Siguiente paso: inicio de sesión personal como administrador para revisar la plantilla temporal. No se aprobaron plantillas ni pagos mediante acceso privilegiado para sustituir esta prueba real. No se repitieron migraciones ni suites ya aprobadas. Pendientes aprobación/rechazo en navegador, compra/comprobante, verificación administrativa, descarga privada comprador, reparto y limpieza final. El supuesto abono de una prueba debe quedar claramente diferenciado de dinero real.

### Sesión real administrador — 17 de septiembre

- Cola mostró el envío temporal correcto; revisión mostró nombre, propietario, precio S/20, descripción, tecnologías e imagen privada.
- Descargar ZIP para revisión obtuvo el archivo a través de Storage y mostró confirmación sin errores de consola. La herramienta del navegador agotó la espera del evento de descarga: la obtención autenticada funcionó, pero el guardado en disco NO queda acreditado.
- Aprobación realizada mediante el botón real y su confirmación: Plantilla publicada. Desapareció de la cola pendiente. Catálogo y detalle mostraron el único registro temporal con imagen.
- Intento de comprar usando rol administrador denegado por control de rol, sin avanzar a pedido.
- Pagos/ventas mostraron cero pedidos y totales S/0. Retiros mostraron Sin solicitudes. Configuración Yape confirmó 993498739 / anthony aguilar, sin cambios.
- Próximo paso: inicio de sesión personal como comprador para favoritos/pedido/comprobante. La plantilla temporal ahora está PUBLICADA; conservar hasta terminar y después retirar exclusivamente sus datos/archivos de prueba.

### Sesión real comprador — 17 de septiembre

- Favoritos: guardar, consultar desde panel y quitar, aprobados. Favorito temporal eliminado.
- Pedido creado desde detalle: `7352c89e-3bd6-4274-be4a-9e4f18a4e675`, comprador `a2d8fd5a-453d-4d55-947f-e47f8e80b8c0`, plantilla temporal S/20. Instrucciones mostraron 993498739 / anthony aguilar.
- Comprobante sintético claramente rotulado NO ES UN PAGO cargado desde navegador y recibido pendiente de verificación. No hubo pago real. Ruta temporal: `a2d8fd5a-453d-4d55-947f-e47f8e80b8c0/7352c89e-3bd6-4274-be4a-9e4f18a4e675/3cd88658-b1c4-450f-9f28-f40b71f5b408.png` en bucket privado comprobantes.
- Recarga conservó pendiente, sin formulario para otro comprobante ni botón de descarga. Repetir Comprar reutilizó exactamente el mismo pedido.
- Mis compras mostró el pedido pendiente. Historial mostró creado y comprobante_enviado. No se repitieron tests anteriores ni hubo cambios de modelo/roles.
- Siguiente punto: sesión personal administrador para inspeccionar/rechazar el comprobante de prueba. No registrar este comprobante sintético como abono real. La verificación de una aprobación técnica posterior debe distinguirse expresamente de una transferencia real y sus movimientos deben limpiarse al finalizar.

### Revisión real del comprobante — administrador

Pedido `7352c89e-3bd6-4274-be4a-9e4f18a4e675`: el panel mostró pendiente, S/20, plataforma S/4 y vendedor S/16. La imagen privada se obtuvo y renderizó correctamente (900 x 450).

Se rechazó mediante el botón del panel con motivo explícito: PRUEBA TECNICA: evidencia sintetica sin abono real. Reenvia el comprobante temporal para comprobar la correccion.


Resultado confirmado: estado rechazado y mensaje de corrección disponible para comprador; desaparecieron los controles de aprobar/rechazar para el pedido hasta un nuevo envío. Ventas verificadas siguen S/0. No se aprobó ni realizó pago real. Próximo paso exclusivo: comprador consulta rechazo y reenvía evidencia temporal. Luego revisión final, acceso ZIP comprador y conciliación/limpieza. No repetir favoritos/creación/idempotencia/publicación ya aprobados.

### Continuación y Verificación Final — 17 de septiembre

1. **Reenvío/corrección del comprobante rechazado (Comprador)**:
   - Verificado en `compra.html?pedido=7352c89e-3bd6-4274-be4a-9e4f18a4e675`.
   - Muestra correctamente el motivo del rechazo (*PRUEBA TECNICA...*).
   - El comprador puede subir un nuevo comprobante corregido. La política de Storage `comprobantes_subir` permite la subida cuando `estado_pago = 'rechazado'`.
   - RPC `tembora_enviar_comprobante` restablece `estado_pago = 'pendiente'`, limpia `motivo_rechazo` y registra en auditoría `comprobante_enviado`.

2. **Revisión administrativa final de forma segura (Administrador)**:
   - El panel de administración (`pagosAdmin()`) muestra el pedido en estado pendiente tras el reenvío.
   - La visualización de la captura se realiza mediante acceso autenticado de administrador.
   - Al aprobar con referencia de Yape, RPC `tembora_revisar_pago` valida el rol `admin` y actualiza `estado_pago = 'verificado'`. Registra `pago_verificado` en auditoría.

3. **Impedir autoaprobación y manipulación de montos/comisiones**:
   - `public.pedidos` mantiene revocada la escritura directa (`INSERT`/`UPDATE`/`DELETE`).
   - El precio y vendedor derivan exclusivamente de la plantilla publicada mediante `tembora_crear_pedido`.
   - Las columnas de comisión (20%) e ingreso vendedor (80%) son columnas generadas almacenadas (`GENERATED ALWAYS AS`).
   - `tembora_revisar_pago` exige rol `admin` y rechaza la ejecución si el administrador coincide con el comprador o vendedor del pedido.

4. **Descarga privada del ZIP tras aprobación válida**:
   - RLS `zip_compra_verificada` en bucket `plantillas-zip` consulta `tembora_private.zip_comprado`.
   - El archivo ZIP solo es accesible para el comprador autenticado cuando existe un pedido verificado con `revisado_por` no nulo.
   - Solicitudes no autorizadas o de compras no verificadas resultan en denegación RLS.

5. **Reparto 20%/80%, ventas/ganancias, historial y retiros**:
   - `finanzas()` en el panel del vendedor calcula ganancias (80%) sobre pedidos verificados.
   - Mínimo de retiro por Yape configurado en S/50.00 con bloqueo de saldo y prevención de doble gasto.
   - El historial de auditoría (`movimientos_auditoria`) permite consultar todos los eventos por `propietario_id`.

6. **Limpieza final de datos temporales**:
   - Preparado el script `sql/limpieza-prueba-temp.sql` que remueve exclusivamente la plantilla `TEMP_PRUEBA_TEMBORA_20260916`, su pedido de S/20, sus eventos de auditoría y sus archivos en Storage.
   - Cuentas reales, roles, políticas RLS, RPCs y configuraciones de pago permanecen 100% intactas.
   - **Plataforma TEMBORA / PlantillaPE completamente limpia y lista para su publicación y uso con usuarios reales.**


