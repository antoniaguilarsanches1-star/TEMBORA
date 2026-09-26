/* OAuth consulta perfiles; el alta pendiente continúa en la selección segura. */
(function () {
    'use strict';
    const retorno = 'https://antoniaguilarsanches1-star.github.io/TEMBORA/login.html?oauth=1';
    let ocupado = false;
    const botones = () => Array.from(document.querySelectorAll('[data-oauth-provider]'));
    function mensaje(texto) {
        const aviso = document.getElementById('oauth-status');
        if (aviso) aviso.textContent = texto;
    }
    async function proveedores() {
        const respuesta = await fetch(supabaseUrl + '/auth/v1/settings', {
            headers: { apikey: supabaseKey }, signal: AbortSignal.timeout(10000)
        });
        if (!respuesta.ok) throw new Error('No se pudo consultar el acceso social.');
        return (await respuesta.json()).external || {};
    }
    async function iniciar(provider) {
        if (ocupado || !['google', 'facebook'].includes(provider)) return;
        const registro = document.getElementById('register-form');
        if (registro) {
            for (const casilla of registro.querySelectorAll('input[type="checkbox"][required]')) {
                if (!casilla.checked) { casilla.reportValidity(); mensaje('Acepta los términos y la política de privacidad para registrarte.'); return; }
            }
        }
        ocupado = true;
        botones().forEach(b => { b.disabled = true; });
        try {
            if (!supabaseClient) throw new Error('No disponible');
            const anterior = await conLimite(supabaseClient.auth.getSession());
            if (anterior.error) throw anterior.error;
            if (anterior.data?.session) {
                const sesion = await verificarSesion();
                if (sesion.code === 'NEEDS_ROLE') { location.replace('elegir-rol.html'); return; }
                mensaje('Ya tienes una sesión activa. Cierra sesión antes de elegir otra cuenta.');
                return;
            }
            const habilitados = await proveedores();
            if (!habilitados[provider]) {
                mensaje('Este proveedor todavía no está habilitado. Usa tu correo y contraseña.');
                return;
            }
            mensaje('Abriendo ' + (provider === 'google' ? 'Google' : 'Facebook') + '…');
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider, options: { redirectTo: retorno, ...(provider === 'facebook' ? { scopes: 'email' } : {}) }
            });
            if (error) throw error;
        } catch (_) {
            mensaje('No se pudo iniciar el acceso social. Comprueba tu conexión o usa correo y contraseña. Si persiste, contacta con soporte.');
        } finally {
            ocupado = false;
            botones().forEach(b => { b.disabled = false; });
        }
    }
    document.addEventListener('DOMContentLoaded', async () => {
        const query = new URLSearchParams(location.search);
        const fragmento = new URLSearchParams(location.hash.slice(1));
        const error = query.get('error') || fragmento.get('error');
        const callback = query.get('oauth') === '1' || fragmento.has('access_token') || !!error;
        // El SDK procesa la sesión; no copiamos ni almacenamos tokens del proveedor.
        if (callback) {
            try {
                mensaje('Validando tu sesión y perfil…');
                const sesion = await verificarSesion();
                history.replaceState(null, '', location.pathname);
                if (error) {
                    mensaje(error === 'access_denied' ? 'Acceso cancelado o no autorizado. Puedes intentarlo de nuevo.' : 'El proveedor no pudo completar el acceso. Reintenta o contacta con soporte.');
                } else if (sesion.code === 'NEEDS_ROLE') {
                    location.replace('elegir-rol.html');
                    return;
                } else if (!sesion.success) {
                    mensaje(sesion.code === 'NO_SESSION' ? 'No se completó el acceso social. Vuelve a intentarlo.' : sesion.error);
                } else {
                    irAlPanelVerificado(sesion.rol);
                    return;
                }
            } catch (_) { mensaje('No se pudo verificar el acceso social. Reintenta o usa correo y contraseña.'); }
        }
        botones().forEach(b => b.addEventListener('click', () => iniciar(b.dataset.oauthProvider)));
        try {
            if (!supabaseClient) throw new Error('No disponible');
            const habilitados = await proveedores();
            botones().forEach(b => { b.hidden = !habilitados[b.dataset.oauthProvider]; b.disabled = false; });
            document.getElementById('oauth-options').hidden = !botones().some(b => !b.hidden);
            if (!callback && !botones().some(b => !b.hidden)) mensaje('El acceso social aún no está disponible. Puedes usar correo y contraseña.');
        } catch (_) {
            if (!callback) mensaje('No se pudo comprobar el acceso social. Puedes usar correo y contraseña o recargar para reintentar.');
        }
    });
})();
