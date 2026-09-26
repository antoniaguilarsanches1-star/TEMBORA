(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('role-form'), status = document.getElementById('role-status');
        const retry = document.getElementById('role-retry');
        let busy = false;
        async function comprobar() {
            form.hidden = true;
            const s = await verificarSesion();
            if (s.success) { irAlPanelVerificado(s.rol); return false; }
            if (['NO_SESSION','SESSION_ERROR'].includes(s.code)) { location.replace('login.html'); return false; }
            if (s.code !== 'NEEDS_ROLE') { status.textContent = s.error; return false; }
            form.hidden = false;
            status.textContent = 'Selecciona comprador o vendedor.';
            return true;
        }
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (busy || !form.reportValidity()) return;
            const rol = form.querySelector('input[name="rol"]:checked')?.value;
            if (!['comprador','vendedor'].includes(rol)) return;
            busy = true; retry.disabled = true;
            form.querySelectorAll('input,button').forEach(el => { el.disabled = true; });
            try {
                if (!await comprobar()) return;
                status.textContent = 'Guardando tu elección…';
                const { error } = await conLimite(supabaseClient.rpc('tembora_elegir_rol_social', { p_rol: rol }));
                if (error) throw error;
                // Consultar el perfil real: otro envío pudo guardar la elección primero.
                await comprobar();
            } catch (_) { status.textContent = 'No se pudo confirmar tu elección. Comprueba de nuevo antes de reintentar.'; }
            finally {
                busy = false; retry.disabled = false;
                form.querySelectorAll('input,button').forEach(el => { el.disabled = false; });
            }
        });
        retry.addEventListener('click', () => { if (!busy) comprobar(); });
        comprobar();
    });
})();
