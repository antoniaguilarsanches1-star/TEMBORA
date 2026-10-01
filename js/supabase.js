/* Autenticación y autorización de navegación.
 * La autorización de datos debe reforzarse con permisos y RLS en Supabase.
 */
const supabaseUrl = 'https://fhowcuxyokkrbttgyrwy.supabase.co';
const supabaseKey = 'sb_publishable_Yl0EkyykwZ_S4N52w3RaIA_RgBYXUI4';
let supabaseClient = null;
try {
    supabaseClient = window.supabase?.createClient(supabaseUrl, supabaseKey) || null;
} catch (_) {
    // Mantener las páginas protegidas bloqueadas si el cliente no puede iniciar.
}

const PANELES_POR_ROL = Object.freeze({
    comprador: 'panel-comprador.html', vendedor: 'panel-vendedor.html', admin: 'admin.html'
});
const ROLES_POR_PAGINA = Object.freeze({
    'panel-comprador.html': ['comprador'],
    'compra.html': ['comprador'],
    'panel-vendedor.html': ['vendedor'],
    'admin.html': ['admin'],
    'vender.html': ['vendedor', 'admin']
});
const paginaActual = window.location.pathname.split('/').pop();
const rolesDePagina = ROLES_POR_PAGINA[paginaActual];
let revisionAcceso = 0;
let usuarioVisible = null;
let cierreEnCurso = null;
let paginaInicializada = false;

function rolValido(rol) {
    return typeof rol === 'string' && Object.prototype.hasOwnProperty.call(PANELES_POR_ROL, rol);
}

async function conLimite(operacion) {
    let temporizador;
    try {
        return await Promise.race([
            operacion,
            new Promise((_, reject) => {
                temporizador = setTimeout(() => reject(new Error('La conexión está tardando demasiado. Reintenta.')), 12000);
            })
        ]);
    } finally {
        clearTimeout(temporizador);
    }
}

async function consultarRol(userId) {
    const { data, error } = await conLimite(supabaseClient.from('perfiles')
        .select('rol').eq('id', userId).maybeSingle());
    if (error) return { success: false, code: 'PROFILE_ERROR', error: 'No se pudo consultar tu perfil. Reintenta o contacta con soporte.' };
    if (!data) return { success: false, code: 'MISSING_PROFILE', error: 'Tu cuenta todavía no tiene perfil.' };
    if (!rolValido(data.rol)) {
        return { success: false, code: 'INVALID_ROLE', error: 'Tu cuenta no tiene un perfil con rol válido. Contacta con soporte; no se asignará un rol automáticamente.' };
    }
    return { success: true, rol: data.rol };
}

let estadoSesion = { success: false, session: null };
let consultaSesion = null;
let versionSesion = 0;

function invalidarSesion() {
    ++versionSesion;
    consultaSesion = null;
    estadoSesion = { success: false, session: null };
    document.documentElement.setAttribute('data-session-state', 'loading');
}

// Todas las vistas consumen el mismo resultado; las consultas simultáneas se comparten.
function verificarSesion() {
    if (consultaSesion) return consultaSesion;
    const version = versionSesion;
    const consulta = consultarSesion().then(resultado => {
        if (version !== versionSesion) return verificarSesion();
        estadoSesion = resultado;
        actualizarUIAutenticacion();
        document.documentElement.setAttribute('data-session-state', resultado.session ? 'authenticated' : 'anonymous');
        return resultado;
    }).finally(() => {
        if (consultaSesion === consulta) consultaSesion = null;
    });
    consultaSesion = consulta;
    return consulta;
}

async function consultarSesion() {
    try {
        if (!supabaseClient) throw new Error('No se pudo cargar Supabase. Comprueba tu conexión y recarga la página.');
        const { data, error } = await conLimite(supabaseClient.auth.getSession());
        if (error) throw new Error('No se pudo comprobar la sesión. Reintenta.');
        const session = data?.session;
        if (!session?.user?.id || !session.access_token) return { success: false, code: 'NO_SESSION', session: null, error: 'Inicia sesión para continuar.' };
        // Verificar la identidad con Auth; no confiar solo en la sesión almacenada.
        const { data: identidad, error: errorUsuario } = await conLimite(supabaseClient.auth.getUser());
        if (errorUsuario || !identidad?.user) {
            return { success: false, code: 'SESSION_ERROR', error: 'No se pudo validar tu sesión. Reintenta o vuelve a iniciar sesión.' };
        }
        if (identidad.user.id !== session.user.id) {
            return { success: false, code: 'SESSION_ERROR', error: 'La sesión cambió. Vuelve a intentarlo.' };
        }
        const perfil = await consultarRol(identidad.user.id);
        if (perfil.code === 'MISSING_PROFILE' && ['google', 'facebook'].includes(identidad.user.app_metadata?.provider)) {
            return { success: false, code: 'NEEDS_ROLE', error: 'Elige comprador o vendedor para continuar.', session, user: identidad.user };
        }
        return { ...perfil, session, user: identidad.user };
    } catch (error) {
        return { success: false, code: 'CONNECTION_ERROR', error: error.message };
    }
}

async function obtenerRolUsuario(userId) {
    // Conserva la interfaz anterior sin admitir roles desde metadatos.
    const sesion = await verificarSesion();
    return sesion.success && sesion.user.id === userId ? sesion.rol : null;
}

async function verificarRol(rolEsperado) {
    const sesion = await verificarSesion();
    return sesion.success && sesion.rol === rolEsperado;
}

function bloquearContenido(mensaje = 'Comprobando sesión y permisos…') {
    if (!rolesDePagina) return;
    document.documentElement.setAttribute('data-auth-pending', '');
    const estado = document.getElementById('auth-message');
    if (estado) estado.textContent = mensaje;
}

function mostrarErrorAuth(mensaje) {
    if (rolesDePagina) {
        bloquearContenido(mensaje);
        return;
    }
    let aviso = document.getElementById('auth-feedback');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'auth-feedback';
        aviso.setAttribute('role', 'alert');
        const texto = document.createElement('p');
        texto.id = 'auth-feedback-text';
        const salir = document.createElement('button');
        salir.type = 'button';
        salir.className = 'btn btn-outline btn-sm';
        salir.setAttribute('data-auth-logout', '');
        salir.textContent = 'Cerrar sesión';
        salir.hidden = !estadoSesion.session;
        aviso.append(texto, salir);
        (document.querySelector('.form-container') || document.body).appendChild(aviso);
    }
    document.getElementById('auth-feedback-text').textContent = mensaje;
}

function irAlPanelVerificado(rol) {
    if (!rolValido(rol)) return false;
    window.location.replace(PANELES_POR_ROL[rol]);
    return true;
}

async function redirigirSegunRol() {
    // Los argumentos de llamadas antiguas se ignoran: siempre consultar perfiles.
    const revision = revisionAcceso;
    const sesion = await verificarSesion();
    if (revision !== revisionAcceso || cierreEnCurso) return false;
    if (!sesion.success) {
        if (sesion.code === 'NEEDS_ROLE') { window.location.replace('elegir-rol.html'); return false; }
        if (sesion.code === 'NO_SESSION') window.location.replace('login.html');
        else mostrarErrorAuth(sesion.error);
        return false;
    }
    return irAlPanelVerificado(sesion.rol);
}

async function protegerPagina(rolesRequeridos = rolesDePagina, conservarFormulario = false) {
    const revision = ++revisionAcceso;
    // Una revalidación no debe colapsar la página ni desmontar los inputs/files.
    if (!usuarioVisible || document.documentElement.hasAttribute('data-auth-pending')) bloquearContenido();
    const sesion = await verificarSesion();
    if (revision !== revisionAcceso || cierreEnCurso) return false;
    if (!sesion.success) {
        bloquearContenido();
        if (sesion.code === 'NEEDS_ROLE') { window.location.replace('elegir-rol.html'); return false; }
        if (sesion.code === 'NO_SESSION' || sesion.code === 'SESSION_ERROR') window.location.replace('login.html');
        else mostrarErrorAuth(sesion.error);
        return false;
    }
    const permitidos = Array.isArray(rolesRequeridos) ? rolesRequeridos : [rolesRequeridos];
    if (!permitidos.includes(sesion.rol)) {
        bloquearContenido();
        irAlPanelVerificado(sesion.rol);
        return false;
    }
    if (usuarioVisible && usuarioVisible !== sesion.user.id) {
        bloquearContenido();
        // No mostrar datos que quedaron cargados de otra cuenta.
        window.location.reload();
        return false;
    }
    usuarioVisible = sesion.user.id;
    document.documentElement.removeAttribute('data-auth-pending');
    document.documentElement.removeAttribute('data-auth-rechecking');
    return true;
}

async function registrarUsuario(email, password, nombreCompleto, rol) {
    if (!['comprador', 'vendedor'].includes(rol)) {
        return { success: false, error: 'Solo puedes registrarte como comprador o vendedor.' };
    }
    try {
        if (!supabaseClient) throw new Error('Supabase no está disponible. Recarga la página.');
        const previa = await conLimite(supabaseClient.auth.getSession());
        if (previa.error) throw new Error('No se pudo comprobar la sesión anterior. Reintenta.');
        if (previa.data?.session) {
            return { success: false, error: 'Ya hay una sesión activa. Ciérrala antes de crear otra cuenta.' };
        }
        const { data, error } = await supabaseClient.auth.signUp({
            email: email.trim(), password,
            options: { data: { nombre_completo: nombreCompleto.trim(), rol } }
        });
        if (error) return { success: false, error: error.message };
        if (!data?.user) return { success: false, error: 'No se pudo completar el registro.' };
        return {
            success: true, requiresEmailConfirmation: !data.session,
            message: data.session ? 'Registro completado.' : 'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.'
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function iniciarSesion(email, password) {
    try {
        if (!supabaseClient) throw new Error('Supabase no está disponible. Recarga la página.');
        const { error } = await supabaseClient.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function cerrarSesion() {
    if (cierreEnCurso) return cierreEnCurso;
    ++revisionAcceso;
    bloquearContenido('Cerrando sesión…');
    cierreEnCurso = Promise.resolve().then(async () => {
        try {
            if (!supabaseClient) throw new Error('Supabase no está disponible. Recarga y vuelve a intentar cerrar sesión.');
            // Esperar a Supabase antes de navegar; no simular un cierre local.
            const { error } = await conLimite(supabaseClient.auth.signOut());
            if (error) throw error;
            const { data, error: errorSesion } = await conLimite(supabaseClient.auth.getSession());
            if (errorSesion || data?.session) throw new Error('No se pudo confirmar el cierre de sesión. Reintenta.');
            usuarioVisible = null;
            invalidarSesion();
            await verificarSesion();
            return { success: true, message: 'Sesión cerrada correctamente.' };
        } catch (error) {
            mostrarErrorAuth(error.message || 'No se pudo cerrar la sesión. Reintenta.');
            return { success: false, error: error.message };
        } finally {
            cierreEnCurso = null;
        }
    });
    return cierreEnCurso;
}

// Delegación única: también cubre los controles de recuperación de errores.
document.addEventListener('click', async function(event) {
    const boton = event.target.closest('[data-auth-logout]');
    if (!boton) return;
    event.preventDefault();
    if (boton.disabled) return;
    boton.disabled = true;
    try {
        const resultado = await cerrarSesion();
        if (resultado.success) window.location.replace('index.html');
    } finally {
        boton.disabled = false;
    }
});

if (supabaseClient) supabaseClient.auth.onAuthStateChange((event, session) => {
    // No llamar a Auth dentro del callback (el SDK mantiene su bloqueo).
    invalidarSesion();
    setTimeout(() => verificarSesion(), 0);
    if (event === 'SIGNED_OUT') {
        ++revisionAcceso;
        if (!rolesDePagina) return;
        bloquearContenido('La sesión ha finalizado.');
        if (!cierreEnCurso) window.location.replace('login.html');
    } else if (event === 'PASSWORD_RECOVERY') {
        // Usuario accedió desde enlace de recuperación de contraseña
        mostrarFormularioRestablecimiento();
    } else if (rolesDePagina && paginaInicializada && ['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
        // Nunca esperar llamadas a Auth dentro de este callback.
        if (event === 'SIGNED_IN' && session?.user.id === usuarioVisible) return;
        ++revisionAcceso;
        if (session?.user.id !== usuarioVisible) bloquearContenido();
        setTimeout(() => protegerPagina(rolesDePagina, true), 0);
    }
});

window.addEventListener('pagehide', () => {
    ++revisionAcceso;
    bloquearContenido();
});
window.addEventListener('pageshow', event => {
    if (event.persisted) window.location.reload();
});
window.addEventListener('focus', () => {
    if (rolesDePagina && paginaInicializada && !cierreEnCurso) protegerPagina(rolesDePagina, true);
    else if (paginaInicializada && !cierreEnCurso) verificarSesion();
});

document.addEventListener('DOMContentLoaded', function() {
    window.sesionInicial = verificarSesion();
    window.accesoPagina = rolesDePagina ? protegerPagina() : window.sesionInicial.then(() => true);
    window.accesoPagina.finally(() => { paginaInicializada = true; });

    const registro = document.getElementById('register-form');
    const login = document.getElementById('login-form');
    const formulario = registro || login;
    if (!formulario) return;

    // Guardar referencia al handler para poder removerlo después
    const formSubmitHandler = async function(event) {
        event.preventDefault();
        const boton = formulario.querySelector('button[type="submit"]');
        if (boton.disabled) return;
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value;
        let rol, nombre;
        if (registro) {
            const seleccion = document.querySelector('input[name="account-type"]:checked')?.value;
            if (!['buyer', 'seller'].includes(seleccion)) return mostrarErrorAuth('Selecciona comprador o vendedor.');
            rol = seleccion === 'buyer' ? 'comprador' : 'vendedor';
            nombre = `${document.getElementById('name').value} ${document.getElementById('lastname').value}`;
            if (password.length < 8) return mostrarErrorAuth('La contraseña debe tener al menos 8 caracteres.');
            if (password !== document.getElementById('confirm-password').value) return mostrarErrorAuth('Las contraseñas no coinciden.');
        }
        const textoOriginal = boton.innerHTML;
        boton.disabled = true;
        boton.textContent = 'Procesando…';
        try {
            const resultado = registro ? await registrarUsuario(email, password, nombre, rol) : await iniciarSesion(email, password);
            if (!resultado.success) return mostrarErrorAuth(resultado.error);
            if (resultado.requiresEmailConfirmation) {
                mostrarErrorAuth(resultado.message);
                return;
            }
            // Mismo camino para login y registro con sesión; nunca usar el rol del formulario.
            await redirigirSegunRol();
        } finally {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;
        }
    };

    formulario.addEventListener('submit', formSubmitHandler);

    // Guardar referencia global para poder removerla
    window.loginFormHandler = formSubmitHandler;

    const forgotBtn = document.getElementById('forgot-password-link');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            mostrarFormularioRecuperacion();
        });
    }
});

async function restablecerContrasena(email) {
    try {
        if (!supabaseClient) throw new Error('Supabase no está disponible. Recarga la página.');
        const correo = String(email || '').trim();
        if (!correo) return { success: false, error: 'Ingresa tu correo electrónico.' };
        const { error } = await supabaseClient.auth.resetPasswordForEmail(correo, {
            redirectTo: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/login.html')
        });
        if (error) {
            // Manejo de errores específicos con mensajes amigables
            if (error.message.includes('rate limit') || error.message.includes('rate')) {
                return { success: false, error: 'Has solicitado varios correos en poco tiempo. Espera unos minutos antes de intentarlo nuevamente.' };
            }
            return { success: false, error: error.message };
        }
        return { success: true, message: 'Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function mostrarFormularioRecuperacion() {
    // Eliminar cualquier formulario previo de recuperación/restablecimiento
    limpiarFormulariosAuth();

    // Deshabilitar completamente el formulario de login para evitar validación y submit
    const loginForm = document.getElementById('login-form');
    const forgotLink = document.getElementById('forgot-password-link');
    if (loginForm) {
        loginForm.style.display = 'none';
        // Remover listener de submit para evitar procesamiento del login
        if (window.loginFormHandler) {
            loginForm.removeEventListener('submit', window.loginFormHandler);
        }
        // Remover atributos required para evitar validación del navegador
        loginForm.querySelectorAll('[required]').forEach(el => el.removeAttribute('required'));
        // Deshabilitar el formulario
        loginForm.disabled = true;
    }
    if (forgotLink) forgotLink.style.display = 'none';

    // Crear formulario de recuperación
    const container = document.querySelector('.form-container');
    if (!container) return;

    const title = container.querySelector('h2');
    const subtitle = container.querySelector('p');
    if (title) title.textContent = 'Recuperar contraseña';
    if (subtitle) subtitle.textContent = 'Te enviaremos un enlace para restablecer tu contraseña al correo electrónico que indiques.';

    const recoverForm = document.createElement('form');
    recoverForm.id = 'recover-password-form';
    recoverForm.innerHTML = `
        <div class="form-group">
            <label for="recover-email">Correo electrónico *</label>
            <input type="email" id="recover-email" name="recover-email" required placeholder="tu@email.com">
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
            <i class="fas fa-paper-plane"></i> Enviar enlace de recuperación
        </button>
        <div class="text-center mt-3">
            <a href="#" id="back-to-login" style="color: var(--primary-color); font-size: 0.875rem;">
                <i class="fas fa-arrow-left"></i> Volver a iniciar sesión
            </a>
        </div>
    `;

    container.insertBefore(recoverForm, container.querySelector('.text-center.mt-3'));

    // Manejar envío del formulario
    recoverForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const email = document.getElementById('recover-email').value.trim();
        const submitBtn = recoverForm.querySelector('button[type="submit"]');

        if (!email) {
            mostrarMensajeAuth('Por favor, ingresa tu correo electrónico.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            const result = await restablecerContrasena(email);
            mostrarMensajeAuth(result.success ? result.message : result.error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar enlace de recuperación';
        }
    });

    // Manejar vuelta al login
    const backBtn = document.getElementById('back-to-login');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            restaurarLoginNormal();
        });
    }
}

function mostrarFormularioRestablecimiento() {
    // Eliminar cualquier formulario previo de recuperación/restablecimiento
    limpiarFormulariosAuth();

    // Ocultar formulario de login normal
    const loginForm = document.getElementById('login-form');
    const forgotLink = document.getElementById('forgot-password-link');
    if (loginForm) loginForm.style.display = 'none';
    if (forgotLink) forgotLink.style.display = 'none';

    // Crear formulario de restablecimiento
    const container = document.querySelector('.form-container');
    if (!container) return;

    const title = container.querySelector('h2');
    const subtitle = container.querySelector('p');
    if (title) title.textContent = 'Establecer nueva contraseña';
    if (subtitle) subtitle.textContent = 'Ingresa y confirma tu nueva contraseña';

    const resetForm = document.createElement('form');
    resetForm.id = 'reset-password-form';
    resetForm.innerHTML = `
        <div class="form-group">
            <label for="new-password">Nueva contraseña *</label>
            <div class="password-container">
                <input type="password" id="new-password" name="new-password" required placeholder="••••••••" minlength="6">
                <button type="button" class="password-toggle">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>
        <div class="form-group">
            <label for="confirm-password">Confirmar contraseña *</label>
            <div class="password-container">
                <input type="password" id="confirm-password" name="confirm-password" required placeholder="••••••••" minlength="6">
                <button type="button" class="password-toggle">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
            <i class="fas fa-key"></i> Actualizar contraseña
        </button>
        <div class="text-center mt-3">
            <a href="#" id="back-to-login-reset" style="color: var(--primary-color); font-size: 0.875rem;">
                <i class="fas fa-arrow-left"></i> Volver a iniciar sesión
            </a>
        </div>
    `;

    container.insertBefore(resetForm, container.querySelector('.text-center.mt-3'));

    // Manejar envío del formulario
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const submitBtn = resetForm.querySelector('button[type="submit"]');

        if (newPassword !== confirmPassword) {
            mostrarMensajeAuth('Las contraseñas no coinciden.');
            return;
        }

        if (newPassword.length < 6) {
            mostrarMensajeAuth('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';

        const result = await actualizarContrasena(newPassword);
        if (result.success) {
            mostrarMensajeAuth('Contraseña actualizada correctamente. Serás redirigido al inicio de sesión.');
            setTimeout(() => {
                window.location.replace('login.html');
            }, 2000);
        } else {
            mostrarMensajeAuth(result.error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-key"></i> Actualizar contraseña';
        }
    });

    // Configurar toggles de visibilidad de contraseña
    resetForm.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Manejar vuelta al login
    const backBtn = document.getElementById('back-to-login-reset');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.replace('login.html');
        });
    }
}

function limpiarFormulariosAuth() {
    // Eliminar formularios de recuperación/restablecimiento previos
    const recoverForm = document.getElementById('recover-password-form');
    const resetForm = document.getElementById('reset-password-form');
    const authFeedback = document.getElementById('auth-feedback');

    if (recoverForm) recoverForm.remove();
    if (resetForm) resetForm.remove();
    if (authFeedback) authFeedback.remove();
}

function restaurarLoginNormal() {
    limpiarFormulariosAuth();

    const loginForm = document.getElementById('login-form');
    const forgotLink = document.getElementById('forgot-password-link');
    const container = document.querySelector('.form-container');

    if (loginForm) {
        loginForm.style.display = 'block';
        loginForm.disabled = false;
        // Restaurar listener de submit
        if (window.loginFormHandler) {
            loginForm.addEventListener('submit', window.loginFormHandler);
        }
        // Restaurar atributos required
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (emailInput) emailInput.setAttribute('required', '');
        if (passwordInput) passwordInput.setAttribute('required', '');
    }
    if (forgotLink) forgotLink.style.display = 'inline-block';

    const title = container?.querySelector('h2');
    const subtitle = container?.querySelector('p');
    if (title) title.textContent = 'Iniciar Sesión';
    if (subtitle) subtitle.textContent = 'Bienvenido de nuevo a TAVIKU';
}

function mostrarMensajeAuth(mensaje) {
    // Versión de mostrarErrorAuth sin botón de cerrar sesión
    let aviso = document.getElementById('auth-feedback');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'auth-feedback';
        aviso.setAttribute('role', 'alert');
        aviso.style.cssText = 'background: #f8d7da; color: #721c24; padding: 1rem; margin: 1rem 0; border-radius: 4px; border: 1px solid #f5c6cb;';
        const texto = document.createElement('p');
        texto.id = 'auth-feedback-text';
        texto.style.margin = '0';
        aviso.appendChild(texto);
        (document.querySelector('.form-container') || document.body).appendChild(aviso);
    }
    document.getElementById('auth-feedback-text').textContent = mensaje;
}

async function actualizarContrasena(newPassword) {
    try {
        if (!supabaseClient) throw new Error('Supabase no está disponible. Recarga la página.');
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'Contraseña actualizada correctamente.' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

window.registrarUsuario = registrarUsuario;
window.iniciarSesion = iniciarSesion;
window.cerrarSesion = cerrarSesion;
window.restablecerContrasena = restablecerContrasena;
window.verificarSesion = verificarSesion;
window.obtenerRolUsuario = obtenerRolUsuario;
window.verificarRol = verificarRol;
window.redirigirSegunRol = redirigirSegunRol;
window.protegerPagina = protegerPagina;

// Mantener la interfaz existente; el envío vive separado de autenticación.
async function crearPlantilla(plantillaData, files, onProgress) {
    if (!window.TemboraEnvios) return { success: false, error: 'El envío no está disponible en esta página.' };
    return window.TemboraEnvios.crear(plantillaData, files, onProgress);
}

// Exportar el envío usado por js/vender.js.
window.crearPlantilla = crearPlantilla;

// Función centralizada para actualizar UI de autenticación
function actualizarUIAutenticacion() {
    // Ignorar resultados pasados por consumidores antiguos: solo el estado compartido manda.
    const sesion = estadoSesion;
    document.querySelectorAll('[data-auth-logout]').forEach(b => { b.hidden = !sesion.session; });
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;
    if (!sesion.session) {
        authButtons.innerHTML = '<a href="login.html" class="btn btn-outline btn-sm">Iniciar sesión</a><a href="registro.html" class="btn btn-primary btn-sm">Registrarse</a>';
        return;
    }
    authButtons.innerHTML = (sesion.success
        ? '<a href="#" id="user-panel-btn" class="btn btn-primary btn-sm"><i class="fas fa-user"></i> Mi Panel</a>' : '') +
        '<a href="#" data-auth-logout class="btn btn-outline btn-sm"><i class="fas fa-sign-out-alt"></i> Salir</a>';
    document.getElementById('user-panel-btn')?.addEventListener('click', e => {
        e.preventDefault();
        redirigirSegunRol();
    });
}

// Exportar función de UI de autenticación
window.actualizarUIAutenticacion = actualizarUIAutenticacion;
