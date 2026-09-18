# TEMBORA — Fase 2, Bloque 1
## Resultado y alcance
Aplicada en el proyecto PlantillaPE (`fhowcuxyokkrbttgyrwy`) la migración
`20260916023953_tembora_fase2_bloque1_modelo_permisos`.
No se cambió ningún archivo del frontend, cuenta real, rol real ni función de autenticación.
No se habilitó el formulario ni se implementaron paneles, catálogo, pagos o descargas.
El SQL guardado en sql/block1-modelo-permisos.sql es el registro del cambio aplicado:
NO volver a ejecutarlo sobre el mismo proyecto.

## Inspección real previa
Se inspeccionaron columnas, defaults, restricciones, relaciones, índices, grants de tabla
y columna, RLS, políticas, funciones y triggers de public, los triggers de auth.users,
los buckets y políticas de storage.objects. Se revisaron también las políticas de las
tablas relacionadas favoritos, pedidos, retiros y resenas, sin modificarlas.
- 0 plantillas, 0 imágenes registradas, 0 objetos en Storage, 12 categorías.
- plantillas tiene FK a perfiles y categorías; imágenes tiene FK a plantillas con CASCADE.
- Estados existentes: pendiente, publicada, rechazada; estado por defecto pendiente.
- Existía el trigger proteger_estado: forzaba pendiente al insertar como vendedor
  y conservaba el estado anterior en sus actualizaciones.
- La protección del rol ya existía por grants de columna en perfiles:
  authenticated solo puede actualizar nombre_completo, avatar_url y bio.
- La función tembora_admin_cambiar_rol valida al administrador y prohíbe cambiar su propio rol.
- es_vendedor incluye vendedor y admin; esta semántica quedó intacta.
- Los permisos de archivos originales comprobaban carpetas del usuario, sin bloquear
  cambios después de la revisión. imagenes-plantillas era público.
- Había grants TRUNCATE/TRIGGER/REFERENCES innecesarios en tablas objetivo; se retiraron
  solo de plantillas, imagenes_plantilla y categorias.

## Modelo resultante
Se mantienen los estados existentes y se añaden a plantillas:
- enviada_revision_at: pendiente + NULL = preparación privada; pendiente + fecha = revisión bloqueada.
- revisada_at: fecha de la última decisión.
- revisada_por: FK al perfil revisor.
- motivo_rechazo: obligatorio al rechazar; se limpia al aprobar o reenviar.

| Operación | Regla |
|---|---|
| Crear | Vendedor o admin, únicamente para sí mismo; el servidor impone pendiente sin envío ni revisión. |
| Editar contenido | Solo propietario vendedor/admin, durante preparación o rechazo. |
| Enviar/re-enviar | Propietario; requiere categoría, nombre, descripción, imagen y ZIP existentes. |
| Aprobar/rechazar | Solo admin distinto del propietario, sobre un envío pendiente. |
| Editar un envío o una publicada | Bloqueado, también para sustituir archivos o galerías. |
| Eliminar | Propietario, preparación/rechazo; retirar primero archivos con Storage API. |
| Leer filas | Visitante/comprador: publicadas; vendedor: también las propias; admin: todas. |
| Cambiar propietario/ID | Bloqueado, incluido para admin desde la aplicación. |
| Modificar métricas/revisión como vendedor | Bloqueado. |

No se crea un estado público adicional. Una fila pendiente en preparación nunca entra
en la cola revisable hasta establecer enviada_revision_at.
Los archivos utilizan rutas relativas `<vendedor UUID>/<plantilla UUID>/<nombre>`.
Se admiten nombres seguros en minúsculas para extensiones .zip, .jpg/.jpeg/.png/.webp.
Las rutas no son URLs públicas ni URLs firmadas persistidas.
Los índices nuevos cubren propietario/estado, revisión, categoría, revisor e imágenes por plantilla.

## Políticas y funciones instaladas
### public.plantillas
- plantillas_crear: propiedad, rol, pendiente y sin enviar.
- plantillas_ver: publicada, propietario autorizado o admin.
- plantillas_editar: propietario en preparación/rechazo, o admin sujeto al trigger.
- plantillas_eliminar: propietario en preparación/rechazo.
- proteger_estado_plantilla() reforzada, ahora SECURITY INVOKER y search_path vacío.
- Trigger existente proteger_estado conservado (INSERT/UPDATE).
- Nuevo trigger tembora_plantilla_eliminar (DELETE).
- actualizar_plantillas_fecha permanece sin cambios.

### public.imagenes_plantilla
- imagenes_crear, imagenes_editar, imagenes_eliminar: propietario editable,
  con bloqueo de la fila padre para coordinar con envío/revisión.
- imagenes_ver: solo si la plantilla padre es visible según su RLS.
- tembora_imagen_proteger: valida ruta propia y evita reasignación de imagen.
- Restricción de orden no negativo.

### public.categorias
- categorias_ver permanece; anon/authenticated conservan únicamente SELECT.
- No se añadió gestión de categorías.

### API SQL para Bloque 2
- tembora_enviar_plantilla(uuid).
- tembora_revisar_plantilla(uuid, text, text).
Ambas SECURITY INVOKER: permisos, RLS y triggers siguen aplicándose.
EXECUTE concedido únicamente a authenticated; no se concedió acceso anónimo.

### Helpers privados (schema tembora_private)
- puede_editar_archivos(uuid): autentica y comprueba propietario/estado con bloqueo de fila.
- archivo_editable(text,text): valida bucket, ruta, extensión y plantilla padre.
- archivo_visible(text,text): ZIP para propietario/admin; imágenes públicas únicamente
  si la plantilla está publicada y la imagen está referenciada.
- proteger_imagen(): función de trigger sin privilegios elevados.
Los tres helpers de políticas usan SECURITY DEFINER de alcance limitado, nombres
cualificados, search_path vacío y permisos de ejecución explícitos.
El schema privado no se expone como API nueva.

## Storage
| Bucket | Público | Límites conservados |
|---|---|---|
| imagenes-plantillas | No, cambiado de público a privado | 5 MB; JPEG, PNG, WebP |
| plantillas-zip | No, conservado | 50 MB; application/zip |
| avatares | Sí, sin cambio | 3 MB; JPEG, PNG, WebP |
| comprobantes | No, sin cambio | 5 MB; JPEG, PNG, WebP |

- Se ajustaron las tres políticas compartidas de imágenes para que conserven solo avatares.
- Se retiraron las cuatro políticas antiguas del ZIP.
- Nuevas políticas: tembora_archivos_ver, tembora_archivos_crear,
  tembora_archivos_eliminar y tembora_archivos_sin_reemplazo.
- No hay UPDATE/upsert/rename para archivos de plantillas. Para corregir un archivo
  editable se utiliza borrar y subir de nuevo mediante Storage API.
- La restricción también impide mover un ZIP al bucket público de avatares.
- La subida requiere crear primero la fila padre.
- Imágenes aprobadas y referenciadas tienen lectura anónima vía las operaciones de
  Storage que aplican RLS; getPublicUrl y /object/public NO sirven para este bucket privado.
- No se concedió acceso de compradores al ZIP.
- No se creó alojamiento de demos; demo_url sigue preparado como URL.
- Solo se modificó el indicador de privacidad de configuración, sin alterar archivos existentes
  (no había objetos). Las futuras subidas/borrados deben usar Storage API.

## Verificación
### Ensayo previo con la configuración propuesta
82/82 casos aprobados ejecutados contra PostgreSQL real en una única transacción revertida:
- Identidades sintéticas: dos vendedores, un comprador, un administrador y anon.
- Creación ajena, autopublicación, cambio de propietario y falsificación de revisión denegados.
- Elevación de rol por UPDATE y por RPC denegada.
- Visibilidad de pendientes/rechazadas/publicadas por cada rol.
- ZIP ajeno y ZIP publicado inaccesibles para visitante/comprador.
- Edición, borrado y subida de archivos bloqueados tras enviar.
- Aprobación y rechazo válidos; rechazo exige motivo.
- Corrección y reenvío de rechazadas.
- Imagen no referenciada permanece privada aunque su plantilla esté publicada.
- Autoaprobación del administrador sobre plantilla propia bloqueada.
- Categorías públicas y de solo lectura; TRUNCATE denegado.
No se iniciaron sesiones reales ni se leyeron contraseñas. Los objetos de Storage usados
en este ensayo eran metadatos sintéticos dentro de la transacción, no subidas de archivos.

### Después de aplicar
La repetición de la batería fue rechazada por la herramienta: "user rejected MCP tool call".
No se reintentó ni se cambió de vía para ejecutar esa prueba.
Se completaron verificaciones de SOLO LECTURA:
- Migración registrada y políticas/funciones/triggers instalados.
- 0 plantillas, 0 imágenes, 0 objetos después del ensayo.
- Huella de todas las cuentas/roles idéntica antes/después.
- Funciones es_admin, es_vendedor, crear_perfil_usuario y tembora_admin_cambiar_rol idénticas.
- Grants de perfiles idénticos.
- Hashes idénticos de app.js, supabase.js, login, registro y los cuatro HTML protegidos.
- Sintaxis JavaScript correcta.
No se afirma prueba de subida/descarga binaria real, navegación con cuentas reales ni
prueba concurrente bajo carga; corresponden a integración y validación posterior.

## Avisos existentes fuera del cambio
El asesor de seguridad no reportó las funciones nuevas del Bloque 1. Permanecen:
- search_path mutable de actualizar_fecha().
- Funciones SECURITY DEFINER antiguas ejecutables por roles de API.
  es_admin/es_vendedor son helpers de políticas; gestionar roles exige validación interna.
- Protección de contraseñas filtradas desactivada.
No se amplió el cambio a Auth por estos avisos. Referencias:
https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Siguiente bloque (no implementado)
Conectar el formulario: crear padre pendiente en preparación, subir archivos por Storage,
guardar sus rutas, registrar galería y llamar tembora_enviar_plantilla.
Mostrar estado real en el panel vendedor; posteriormente conectar la revisión admin y catálogo.
Resolver los errores de upload/URL/limpieza detectados en el análisis previo.
Probar archivos reales y regresión de sesión con entrada manual de credenciales por el usuario.
Las pantallas actuales siguen sin enviar plantillas; la función antigua crearPlantilla aún
no es compatible con este contrato y no debe habilitarse sin adaptación.
