# TAVIKU — activar Google/Facebook y corrección de scroll

## Estado (24 septiembre 2026)

Código conectado en login.html y registro.html mediante js/auth-oauth.js. Consulta pública de Auth confirmó Google=false y Facebook=false. Botones ocultos hasta que el proveedor esté habilitado; no se anuncia una integración autenticada como probada. No se cambiaron configuraciones remotas, RLS, roles ni credenciales.

## URLs exactas del proyecto actual

La URL de producción procede de los canonical existentes, no de un dominio inventado:
- Site URL: https://antoniaguilarsanches1-star.github.io/TEMBORA/
- Retorno OAuth (Redirect URLs en Supabase): https://antoniaguilarsanches1-star.github.io/TEMBORA/login.html?oauth=1
- Conservar también los retornos actuales de correo/recuperación, incluido https://antoniaguilarsanches1-star.github.io/TEMBORA/login.html
- Callback para Google y Meta: https://fhowcuxyokkrbttgyrwy.supabase.co/auth/v1/callback

## Configuración manual

1. Supabase > Authentication > URL Configuration: confirmar Site URL y añadir el retorno OAuth exacto sin eliminar URLs actuales. Publicar primero los archivos actualizados en GitHub Pages (no se realizó commit/push).
2. Google Auth Platform / Google Cloud: crear cliente OAuth de tipo Web application; origen JavaScript https://antoniaguilarsanches1-star.github.io (sin /TEMBORA); URI de redirección el callback Supabase indicado arriba. Configurar consentimiento TAVIKU y scopes openid, email y profile; añadir usuarios de prueba mientras esté en Testing o pasar a producción según los requisitos de Google.
3. Supabase > Authentication > Sign In / Providers > Google: activar e introducir Client ID y Client Secret de Google. El secreto solo se introduce allí, nunca en HTML/JS.
4. Meta for Developers: configurar Facebook Login para web y su permiso email; URL del sitio https://antoniaguilarsanches1-star.github.io/TEMBORA/ y Valid OAuth Redirect URIs con el callback Supabase exacto. Completar las URLs reales de privacidad y eliminación de datos exigidas por Meta. En desarrollo solo acceden cuentas de prueba/roles de la app; para usuarios externos completar los requisitos y activar modo Live.
5. Supabase > Authentication > Sign In / Providers > Facebook: activar e introducir App ID y App Secret de Meta. No colocar el secreto en el frontend.
6. Recargar login/registro después de habilitar proveedores. El botón correspondiente aparecerá al consultar /auth/v1/settings. Probar consentimiento, cancelación y regreso al panel desde producción; requiere inicio personal en Google/Facebook.

## Perfiles y roles

Se verificó el trigger activo nuevo_usuario_crear_perfil sobre auth.users. Usa crear_perfil_usuario(), que crea public.perfiles y asigna comprador por defecto. OAuth no transmite un rol elegido en el formulario ni altera perfiles existentes; estos se consultan mediante verificarSesion y se redirigen al panel de su rol real. Una cuenta social nueva empieza como comprador (se informa junto a los botones); no se implementa una promoción automática a vendedor/admin. El nombre puede quedar vacío con el trigger actual y se puede completar en Mi perfil. Si falta un perfil, se muestra error y no se inventa un rol.

El cliente Supabase existente conserva su flujo y almacenamiento; la integración usa signInWithOAuth y el retorno manejado por el SDK. No copia tokens de proveedor ni credenciales. Mensajes de cancelación, fallo de proveedor/conexión y perfil inválido sin mostrar detalles sensibles. Correo/contraseña conserva sus handlers.

## Scroll

Causa: focus y TOKEN_REFRESHED/USER_UPDATED ejecutaban protegerPagina, que añadía data-auth-pending. Su CSS display:none colapsaba el contenido y forzaba el scroll hacia arriba, especialmente al volver del selector de archivos.

En vender.html una revalidación de una cuenta ya visible conserva el espacio mediante data-auth-rechecking/visibility:hidden, sin resetear ni reemplazar inputs, archivos o formulario. La carga inicial, cierre/cambio de cuenta y errores conservan el bloqueo y las redirecciones existentes. Se sigue consultando la sesión/perfil: no se ignoran renovaciones ni se relajan permisos.

## Archivos y comprobación

Modificados: login.html, registro.html, vender.html, js/supabase.js.
Nuevos: js/auth-oauth.js, tests/oauth-scroll.test.cjs, este documento.
Sintaxis comprobada; pruebas agrupadas de proveedores, destino, callback/roles, cancelación, errores y revalidación. Prueba OAuth real pendiente de configuración externa y consentimiento personal. Sin commit ni push.

Referencias:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-facebook
- https://supabase.com/docs/guides/auth/redirect-urls

## Actualización: selección inicial de rol social

El flujo descrito arriba que asignaba comprador por defecto queda sustituido por esta actualización. Migración aplicada: tembora_seleccion_inicial_rol_social (fuente sql/oauth-seleccion-rol.sql).

Google/Facebook nuevos no reciben perfil automáticamente. elegir-rol.html ofrece solo comprador/vendedor; tembora_elegir_rol_social crea el perfil propio una sola vez bajo bloqueo del usuario. Una elección repetida devuelve el rol existente, sin modificarlo. Admin se rechaza en servidor incluso si se manipula el frontend. Se comprueba el proveedor en auth.users.raw_app_meta_data, nunca en metadatos editables. El registro por correo mantiene el trigger anterior para comprador/vendedor. No se migraron ni tocaron roles de usuarios existentes, tampoco RLS ni funciones administrativas.

verificarSesion reconoce NEEDS_ROLE solo para una cuenta social autenticada sin perfil. OAuth y guards llevan a elegir-rol.html; usuarios con rol van a su panel sin mostrar selección. La página revalida tras guardar y permite comprobar una respuesta incierta sin duplicar perfiles.

Pruebas: SQL reversible aprobado con usuarios sintéticos (Google, Facebook, correo vendedor, admin denegado, elección inmutable, ejecución anónima denegada), ROLLBACK completo. Sintaxis y 8 pruebas previas de OAuth/scroll aprobadas. La prueba personal con Google/Meta sigue pendiente de su configuración. Publicar también elegir-rol.html y js/elegir-rol.js. No cambia el retorno OAuth ya documentado. Sin commit/push.
