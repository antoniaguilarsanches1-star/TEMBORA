/* Interfaz exclusiva del envío vendedor. No modifica los guards de autenticación. */
(function () {
    'use strict';
    let busy = false, ready = false, form, fields, status, reference;
    const buttonIds = ['sell-retry','sell-check','sell-discard','sell-new'];
    function message(text) { status.textContent = text; }
    function actions(visible = []) {
        for (const id of buttonIds) document.getElementById(id).hidden = !visible.includes(id);
    }
    function activity(value) {
        busy = value;
        form.setAttribute('aria-busy', String(value));
        fields.disabled = value || !ready;
        for (const id of buttonIds) document.getElementById(id).disabled = value;
    }
    function render(result) {
        actions();
        reference.hidden = !result.id && !result.plantilla;
        reference.textContent = reference.hidden ? '' : 'Referencia: ' + (result.id || result.plantilla.id);
        if (result.success && result.plantilla) {
            ready = false;
            form.reset();
            message(result.message);
            actions(['sell-check','sell-new']);
        } else if (result.recuperable) {
            ready = false;
            message(result.error);
            actions(result.preparada ? ['sell-check','sell-discard'] : ['sell-check']);
        } else if (result.success && result.vacio) {
            ready = true;
            message(result.message || 'Completa los datos y archivos para enviar tu plantilla a revisión.');
        } else {
            message(result.error || 'No se pudo completar la operación.');
            // Preserve form values for retry; never announce success on error.
        }
    }
    async function init() {
        if (busy) return;
        ready = false; activity(true); actions(); message('Comprobando acceso y cargando categorías…');
        try {
            if (!await window.accesoPagina) return;
            const s = await verificarSesion();
            if (!s.success || s.rol !== 'vendedor') {
                message('Solo una cuenta vendedor puede utilizar este formulario.');
                return;
            }
            const categorias = await window.TemboraEnvios.categorias();
            const select = document.getElementById('category');
            select.replaceChildren(new Option('Selecciona una categoría', ''));
            for (const categoria of categorias) select.add(new Option(categoria.nombre, String(categoria.id)));
            const estado = await window.TemboraEnvios.comprobar();
            render(estado);
            if (!estado.success && !estado.recuperable) actions(['sell-retry']);
        } catch (e) {
            message(e.message || 'No se pudo cargar el envío. Reintenta.');
            actions(['sell-retry']);
        } finally { activity(false); }
    }
    async function enviar(target) {
        if (!ready || busy || target !== form || !form.reportValidity()) return;
        const value = id => document.getElementById(id).value;
        const datos = { nombre:value('template-name'), categoria_id:value('category'), precio:value('price'),
            descripcion:value('description'), tecnologias:value('technologies'), demo_url:value('demo-url') };
        const files = { imagenPrincipal:document.getElementById('main-image').files[0],
            imagenesAdicionales:Array.from(document.getElementById('additional-images').files),
            archivoZip:document.getElementById('zip-file').files[0] };
        activity(true); actions();
        try {
            render(await crearPlantilla(datos, files, message));
        } catch (_) {
            ready = false;
            message('No se pudo confirmar el resultado. Comprueba el estado antes de volver a enviar.');
            actions(['sell-check']);
        } finally { activity(false); }
    }
    async function recover(method) {
        if (busy) return;
        activity(true);
        message(method === 'descartar' ? 'Retirando preparación incompleta…' : 'Comprobando el envío…');
        try {
            const r = await window.TemboraEnvios[method]();
            render(r);
            if (!r.success && !r.recuperable) { ready = false; actions(['sell-check']); }
        } finally { activity(false); }
    }
    window.TemboraVenta = { enviar };
    document.addEventListener('DOMContentLoaded', () => {
        form = document.getElementById('sell-form');
        fields = document.getElementById('sell-fields');
        status = document.getElementById('sell-status');
        reference = document.getElementById('sell-reference');
        document.getElementById('sell-retry').addEventListener('click', init);
        document.getElementById('sell-check').addEventListener('click', () => recover('comprobar'));
        document.getElementById('sell-discard').addEventListener('click', () => recover('descartar'));
        document.getElementById('sell-new').addEventListener('click', () => recover('nuevo'));
        window.addEventListener('beforeunload', e => {
            if (busy) { e.preventDefault(); e.returnValue = ''; }
        });
        init();
    });
})();
