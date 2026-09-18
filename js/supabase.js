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
    if (!data || !rolValido(data.rol)) {
        return { success: false, code: 'INVALID_ROLE', error: 'Tu cuenta no tiene un perfil con rol válido. Contacta con soporte; no se asignará un rol automáticamente.' };
    }
    return { success: true, rol: data.rol };
}

async function verificarSesion() {
    try {
        if (!supabaseClient) throw new Error('No se pudo cargar Supabase. Comprueba tu conexión y recarga la página.');
        const { data, error } = await conLimite(supabaseClient.auth.getSession());
        if (error) throw new Error('No se pudo comprobar la sesión. Reintenta.');
        const session = data?.session;
        if (!session) return { success: false, code: 'NO_SESSION', session: null, error: 'Inicia sesión para continuar.' };
        // Verificar la identidad con Auth; no confiar solo en la sesión almacenada.
        const { data: identidad, error: errorUsuario } = await conLimite(supabaseClient.auth.getUser());
        if (errorUsuario || !identidad?.user) {
            return { success: false, code: 'SESSION_ERROR', error: 'No se pudo validar tu sesión. Reintenta o vuelve a iniciar sesión.' };
        }
        if (identidad.user.id !== session.user.id) {
            return { success: false, code: 'SESSION_ERROR', error: 'La sesión cambió. Vuelve a intentarlo.' };
        }
        const perfil = await consultarRol(identidad.user.id);
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
        if (sesion.code === 'NO_SESSION') window.location.replace('login.html');
        else mostrarErrorAuth(sesion.error);
        return false;
    }
    return irAlPanelVerificado(sesion.rol);
}

async function protegerPagina(rolesRequeridos = rolesDePagina) {
    const revision = ++revisionAcceso;
    bloquearContenido();
    const sesion = await verificarSesion();
    if (revision !== revisionAcceso || cierreEnCurso) return false;
    if (!sesion.success) {
        if (sesion.code === 'NO_SESSION' || sesion.code === 'SESSION_ERROR') window.location.replace('login.html');
        else mostrarErrorAuth(sesion.error);
        return false;
    }
    const permitidos = Array.isArray(rolesRequeridos) ? rolesRequeridos : [rolesRequeridos];
    if (!permitidos.includes(sesion.rol)) {
        irAlPanelVerificado(sesion.rol);
        return false;
    }
    if (usuarioVisible && usuarioVisible !== sesion.user.id) {
        // No mostrar datos que quedaron cargados de otra cuenta.
        window.location.reload();
        return false;
    }
    usuarioVisible = sesion.user.id;
    document.documentElement.removeAttribute('data-auth-pending');
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
    if (event === 'SIGNED_OUT') {
        ++revisionAcceso;
        if (!rolesDePagina) return;
        bloquearContenido('La sesión ha finalizado.');
        if (!cierreEnCurso) window.location.replace('login.html');
    } else if (rolesDePagina && paginaInicializada && ['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
        // Nunca esperar llamadas a Auth dentro de este callback.
        if (event === 'SIGNED_IN' && session?.user.id === usuarioVisible) return;
        ++revisionAcceso;
        bloquearContenido();
        setTimeout(() => protegerPagina(), 0);
    }
});

window.addEventListener('pagehide', () => {
    ++revisionAcceso;
    bloquearContenido();
});
window.addEventListener('pageshow', event => {
    if (rolesDePagina && event.persisted) window.location.reload();
});
window.addEventListener('focus', () => {
    if (rolesDePagina && paginaInicializada && !cierreEnCurso) protegerPagina();
});

document.addEventListener('DOMContentLoaded', function() {
    window.accesoPagina = rolesDePagina ? protegerPagina() : Promise.resolve(true);
    window.accesoPagina.finally(() => { paginaInicializada = true; });

    const registro = document.getElementById('register-form');
    const login = document.getElementById('login-form');
    const formulario = registro || login;
    if (!formulario) return;
    formulario.addEventListener('submit', async function(event) {
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
    });

    const forgotBtn = document.getElementById('forgot-password-link');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const emailInput = document.getElementById('email');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email) {
                if (emailInput) emailInput.focus();
                return mostrarErrorAuth('Por favor, ingresa tu correo electrónico arriba y vuelve a hacer clic en ¿Olvidaste tu contraseña?.');
            }
            forgotBtn.style.pointerEvents = 'none';
            forgotBtn.style.opacity = '0.6';
            try {
                const res = await restablecerContrasena(email);
                mostrarErrorAuth(res.success ? res.message : res.error);
            } finally {
                forgotBtn.style.pointerEvents = '';
                forgotBtn.style.opacity = '';
            }
        });
    }
});

async function restablecerContrasena(email) {
    try {
        if (!supabaseClient) throw new Error('Supabase no está disponible. Recarga la página.');
        const correo = String(email || '').trim();
        if (!correo) return { success: false, error: 'Ingresa tu correo electrónico en el campo de inicio de sesión.' };
        const { error } = await supabaseClient.auth.resetPasswordForEmail(correo, {
            redirectTo: window.location.origin + '/login.html'
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'Se ha enviado un enlace de restablecimiento a tu correo electrónico.' };
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

// ============================================
// FUNCIONES PARA PANEL DE COMPRADOR
// ============================================

/**
 * Obtener datos del perfil del comprador
 * @param {string} userId - ID del usuario
 * @returns {Promise} - Datos del perfil
 */
async function obtenerPerfilComprador(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error al obtener perfil:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error catch al obtener perfil:', error);
        return null;
    }
}

/**
 * Contar compras totales del comprador
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de compras
 */
async function contarComprasTotales(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .eq('comprador_id', userId);

        if (error) {
            console.error('Error al contar compras:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar compras:', error);
        return 0;
    }
}

/**
 * Contar descargas disponibles del comprador
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de descargas disponibles
 */
async function contarDescargasDisponibles(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .eq('comprador_id', userId)
            .eq('estado_pago', 'verificado');

        if (error) {
            console.error('Error al contar descargas:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar descargas:', error);
            return 0;
    }
}

/**
 * Contar favoritos del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de favoritos
 */
async function contarFavoritos(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('favoritos')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', userId);

        if (error) {
            console.error('Error al contar favoritos:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar favoritos:', error);
        return 0;
    }
}

/**
 * Obtener compras recientes del comprador
 * @param {string} userId - ID del usuario
 * @returns {Promise} - Array de compras
 */
async function obtenerComprasRecientes(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select(`
                id,
                monto,
                estado_pago,
                created_at,
                plantilla:plantillas!plantilla_id(id, nombre),
                vendedor:perfiles!vendedor_id(nombre_completo)
            `)
            .eq('comprador_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error al obtener compras:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error catch al obtener compras:', error);
        return [];
    }
}

// Exportar funciones nuevas al objeto global
window.obtenerPerfilComprador = obtenerPerfilComprador;
window.contarComprasTotales = contarComprasTotales;
window.contarDescargasDisponibles = contarDescargasDisponibles;
window.contarFavoritos = contarFavoritos;
window.obtenerComprasRecientes = obtenerComprasRecientes;

// ============================================
// FUNCIONES PARA PANEL DE VENDEDOR
// ============================================

/**
 * Contar plantillas del vendedor
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de plantillas
 */
async function contarPlantillasVendedor(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('plantillas')
            .select('*', { count: 'exact', head: true })
            .eq('vendedor_id', userId);

        if (error) {
            console.error('Error al contar plantillas:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar plantillas:', error);
        return 0;
    }
}

/**
 * Contar plantillas publicadas del vendedor
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de plantillas publicadas
 */
async function contarPlantillasPublicadas(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('plantillas')
            .select('*', { count: 'exact', head: true })
            .eq('vendedor_id', userId)
            .eq('estado', 'publicada');

        if (error) {
            console.error('Error al contar plantillas publicadas:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar plantillas publicadas:', error);
            return 0;
    }
}

/**
 * Contar plantillas pendientes del vendedor
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de plantillas pendientes
 */
async function contarPlantillasPendientes(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('plantillas')
            .select('*', { count: 'exact', head: true })
            .eq('vendedor_id', userId)
            .eq('estado', 'pendiente');

        if (error) {
            console.error('Error al contar plantillas pendientes:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar plantillas pendientes:', error);
            return 0;
    }
}

/**
 * Contar ventas del vendedor
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Número de ventas
 */
async function contarVentasVendedor(userId) {
    try {
        const { count, error } = await supabaseClient
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .eq('vendedor_id', userId)
            .eq('estado_pago', 'verificado');

        if (error) {
            console.error('Error al contar ventas:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Error catch al contar ventas:', error);
        return 0;
    }
}

/**
 * Calcular ganancias del vendedor
 * @param {string} userId - ID del usuario
 * @returns {Promise<number>} - Ganancias totales
 */
async function calcularGananciasVendedor(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select('monto, porcentaje_comision')
            .eq('vendedor_id', userId)
            .eq('estado_pago', 'verificado');

        if (error) {
            console.error('Error al calcular ganancias:', error);
            return 0;
        }

        let ganancias = 0;
        if (data) {
            data.forEach(pedido => {
                const comision = pedido.monto * (pedido.porcentaje_comision / 100);
                ganancias += pedido.monto - comision;
            });
        }

        return ganancias;
    } catch (error) {
        console.error('Error catch al calcular ganancias:', error);
        return 0;
    }
}

/**
 * Obtener plantillas del vendedor
 * @param {string} userId - ID del usuario
 * @returns {Promise} - Array de plantillas
 */
async function obtenerPlantillasVendedor(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('plantillas')
            .select(`
                id,
                nombre,
                categoria_id,
                descripcion,
                precio,
                tecnologias,
                demo_url,
                imagen_principal,
                estado,
                ventas,
                calificacion,
                created_at
            `)
            .eq('vendedor_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al obtener plantillas:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error catch al obtener plantillas:', error);
        return [];
    }
}

/**
 * Obtener categorías
 * @returns {Promise} - Array de categorías
 */
async function obtenerCategorias() {
    try {
        const { data, error } = await supabaseClient
            .from('categorias')
            .select('*')
            .order('nombre');

        if (error) {
            console.error('Error al obtener categorías:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error catch al obtener categorías:', error);
        return [];
    }
}

// Mantener la interfaz existente; el envío vive separado de autenticación.
async function crearPlantilla(plantillaData, files, onProgress) {
    if (!window.TemboraEnvios) return { success: false, error: 'El envío no está disponible en esta página.' };
    return window.TemboraEnvios.crear(plantillaData, files, onProgress);
}

// Exportar funciones de vendedor al objeto global
window.contarPlantillasVendedor = contarPlantillasVendedor;
window.contarPlantillasPublicadas = contarPlantillasPublicadas;
window.contarPlantillasPendientes = contarPlantillasPendientes;
window.contarVentasVendedor = contarVentasVendedor;
window.calcularGananciasVendedor = calcularGananciasVendedor;
window.obtenerPlantillasVendedor = obtenerPlantillasVendedor;
window.obtenerCategorias = obtenerCategorias;
window.crearPlantilla = crearPlantilla;
