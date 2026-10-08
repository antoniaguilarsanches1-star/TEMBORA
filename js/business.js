/* Solicitudes y galería del pilar Para negocios. No participa en compras ni pagos. */
(() => {
    'use strict';
    const bucket = 'webs-completas';
    const el = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    function demoUrl(value) {
        try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
        catch { return null; }
    }
    async function cover(path) {
        if (!path) return null;
        const { data, error } = await supabaseClient.storage.from(bucket).createSignedUrl(path, 600);
        return error ? null : data?.signedUrl;
    }
    async function listModels(admin = false) {
        if (!supabaseClient) throw new Error('Servicio no disponible');
        let query = supabaseClient.from('webs_completas').select('*');
        if (!admin) query = query.eq('estado', 'publicada');
        const { data, error } = await query.order('posicion').order('nombre');
        if (error) throw error;
        return data || [];
    }
    function button(text, handler, className = 'btn btn-primary') {
        const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', handler); return node;
    }
    document.addEventListener('DOMContentLoaded', async () => {
        const form = document.getElementById('business-request');
        if (form && document.body.dataset.publicPage === 'pagina-personalizada') {
            const params = new URLSearchParams(location.search);
            const selectedModel = params.get('modelo');
            if (selectedModel && selectedModel.length <= 160) {
                const description = document.getElementById('request-description');
                if (description && !description.value.trim()) description.value = 'Me interesa el modelo "' + selectedModel + '". Quiero adaptarlo a mi negocio.';
            }
        }
        if (form) {
            form.addEventListener('input', event => event.target.setCustomValidity?.(''));
            form.addEventListener('submit', event => {
                event.preventDefault();
                form.querySelectorAll('[required]').forEach(input => input.setCustomValidity(input.value.trim() ? '' : 'Completa este campo.'));
                if (!form.reportValidity()) return;
                const values = [...new FormData(form)].map(([name, value]) => {
                    if (name === 'Web elegida') value = form.querySelector('#chosen-model').selectedOptions[0].textContent;
                    return name + ': ' + (value.trim() || 'Por coordinar');
                });
                openWhatsApp(['Solicitud de página para negocio', ...values].join('\n'));
                const status = document.getElementById('request-status');
                status.replaceChildren(el('span', 'Solicitud preparada. Confirma el envío en WhatsApp. Si no se abrió, '));
                const retry = el('a', 'abre tu solicitud aquí');
                retry.href = generateWhatsAppMessage(['Solicitud de página para negocio', ...values].join('\n'));
                retry.target = '_blank'; retry.rel = 'noopener noreferrer'; status.append(retry);
            });
        }
        if (document.getElementById('webs-gallery')) {
            document.getElementById('webs-retry').addEventListener('click', loadGallery);
            await loadGallery();
        }
        if (document.getElementById('webs-admin')) {
            const session = await window.sesionInicial;
            if (session?.success && session.rol === 'admin' && await window.accesoPagina) await initAdmin();
        }
    });
    async function loadGallery() {
        const root = document.getElementById('webs-gallery');
        const status = document.getElementById('webs-status');
        const retry = document.getElementById('webs-retry');
        const select = document.getElementById('chosen-model');
        const previous = select?.value || '';
        retry.hidden = true; status.textContent = 'Cargando modelos…'; root.replaceChildren();
        if (select) select.replaceChildren(new Option('Selecciona un modelo de la galería', ''));
        try {
            const rows = await listModels();
            for (const model of rows) {
                if (select) select.add(new Option(model.nombre + ' — ' + model.tipo_negocio, model.id));
                const card = el('article', undefined, 'pillar-card');
                const img = el('img', undefined, 'web-cover'); img.alt = 'Vista previa de ' + model.nombre; img.loading = 'lazy';
                const url = await cover(model.portada);
                if (url) { img.src = url; card.append(img); }
                card.append(el('span', model.tipo_negocio), el('h3', model.nombre), el('p', model.descripcion));
                const allFeatures = model.funciones || [];
                const features = el('ul', undefined, 'web-features');
                const visibleFeatures = allFeatures.slice(0, 7);
                visibleFeatures.forEach(text => features.append(el('li', text)));
                card.append(features);

                if (allFeatures.length > 7) {
                    const more = button('Ver todas las funciones', () => {
                        const expanded = more.getAttribute('aria-expanded') === 'true';
                        features.replaceChildren();
                        (expanded ? visibleFeatures : allFeatures).forEach(text => features.append(el('li', text)));
                        more.textContent = expanded ? 'Ver todas las funciones' : 'Ver menos';
                        more.setAttribute('aria-expanded', String(!expanded));
                    }, 'web-features-toggle');
                    more.setAttribute('aria-expanded', 'false');
                    card.append(more);
                }

                if (model.descripcion_panel || (model.imagenes_admin || []).length) {
                    const panel = el('section', undefined, 'web-admin-preview');
                    panel.append(el('h4', 'Panel administrativo incluido'));
                    if (model.descripcion_panel) panel.append(el('p', model.descripcion_panel));
                    if ((model.imagenes_admin || []).length) {
                        const gallery = el('div', undefined, 'web-admin-images');
                        for (const path of model.imagenes_admin) {
                            const signed = await cover(path);
                            if (!signed) continue;
                            const adminImg = el('img');
                            adminImg.src = signed;
                            adminImg.alt = 'Vista del panel administrativo de ' + model.nombre;
                            adminImg.loading = 'lazy';
                            gallery.append(adminImg);
                        }
                        if (gallery.childElementCount) panel.append(gallery);
                    }
                    card.append(panel);
                }

                const actions = el('div', undefined, 'pillar-actions');
                const demo = demoUrl(model.demo_url);
                if (demo) {
                    const a = el('a', 'Ver demo', 'btn btn-outline'); a.href = demo; a.target = '_blank'; a.rel = 'noopener noreferrer'; actions.append(a);
                }
                const request = el('a', 'Quiero una web así', 'btn btn-primary');
                request.href = 'pagina-personalizada.html?modelo=' + encodeURIComponent(model.nombre) + '#business-request';
                actions.append(request);
                card.append(actions); root.append(card);
            }
            if (select && [...select.options].some(option => option.value === previous)) select.value = previous;
            status.textContent = rows.length ? '' : 'Estamos preparando los primeros modelos. Puedes contarnos tu idea en Para negocios.';
        } catch (_) {
            status.textContent = 'No pudimos cargar las webs completas. Reintenta o contáctanos desde Para negocios.'; retry.hidden = false;
        }
    }
    async function initAdmin() {
        const root = document.getElementById('webs-admin-list');
        const form = document.getElementById('webs-admin-form');
        const status = document.getElementById('webs-admin-status');
        const save = form.querySelector('[type="submit"]');
        let current = null, rows = [], loading = false, newId = crypto.randomUUID();
        function reset() { current = null; newId = crypto.randomUUID(); form.reset(); document.getElementById('web-editor-title').textContent = 'Nueva web completa'; }
        function edit(model) {
            current = model; form.reset();
            for (const name of ['nombre', 'tipo_negocio', 'descripcion', 'demo_url', 'estado', 'posicion']) form.elements[name].value = model[name];
            form.elements.funciones.value = model.funciones.join('\n');
            form.elements.descripcion_panel.value = model.descripcion_panel || '';
            document.getElementById('web-editor-title').textContent = 'Editar: ' + model.nombre;
            form.scrollIntoView({ behavior: 'smooth', block: 'start' }); form.elements.nombre.focus({ preventScroll: true });
        }
        async function refresh() {
            status.textContent = 'Cargando webs completas…';
            try {
                rows = await listModels(true); root.replaceChildren();
                rows.forEach(model => {
                    const card = el('article', undefined, 'pillar-card');
                    card.append(el('h3', model.nombre), el('p', `${model.tipo_negocio} · ${model.estado} · Posición ${model.posicion}`));
                    card.append(button('Editar modelo', () => edit(model), 'btn btn-outline'));
                    root.append(card);
                });
                status.textContent = rows.length ? '' : 'Todavía no hay modelos. Crea el primero.';
            } catch (_) { status.textContent = 'No se pudieron cargar los modelos. Usa Actualizar para reintentar.'; }
        }
        document.getElementById('webs-admin-reload').addEventListener('click', refresh);
        document.getElementById('webs-admin-new').addEventListener('click', reset);
        form.addEventListener('input', event => event.target.setCustomValidity?.(''));
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (loading) return;
            const fields = form.elements;
            for (const input of form.querySelectorAll('[required]')) input.setCustomValidity(input.value.trim() ? '' : 'Completa este campo.');
            fields.demo_url.setCustomValidity(fields.demo_url.value && !demoUrl(fields.demo_url.value) ? 'Usa un enlace HTTPS válido sin credenciales.' : '');
            if (!form.reportValidity()) return;
            const file = fields.portada.files[0];
            const adminFiles = [...fields.imagenes_admin.files].slice(0, 1);
            if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                status.textContent = 'Elige una portada JPG, PNG o WebP de hasta 5 MB.'; return;
            }
                        if (adminFiles.some(image => !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024)) {
                status.textContent = 'La imagen del panel debe ser JPG, PNG o WebP y pesar hasta 5 MB.'; return;
            }
            const record = {
                nombre: fields.nombre.value.trim(), tipo_negocio: fields.tipo_negocio.value,
                descripcion: fields.descripcion.value.trim(), funciones: fields.funciones.value.split('\n').map(s => s.trim()).filter(Boolean),
                descripcion_panel: fields.descripcion_panel.value.trim(),
                imagenes_admin: current?.imagenes_admin || [],
                demo_url: fields.demo_url.value.trim(), estado: fields.estado.value, posicion: Number(fields.posicion.value),
                portada: current?.portada || null
            };
            if (record.estado === 'publicada' && (!(file || record.portada) || !demoUrl(record.demo_url) || !record.funciones.length)) {
                status.textContent = 'Para publicar agrega una portada, una demo HTTPS y al menos una función.'; return;
            }
            loading = true; save.disabled = true; status.textContent = 'Guardando modelo…';
            const uploaded = [];
            let saveAttempted = false;
            try {
                const session = await verificarSesion();
                if (!session?.success || session.rol !== 'admin') throw new Error('Tu sesión de administrador no está disponible.');
                if (file) {
                    const path = crypto.randomUUID() + '.' + ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
                    const { error } = await supabaseClient.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
                    if (error) throw error;
                    uploaded.push(path); record.portada = path;
                }
                if (adminFiles.length) {
                    const newAdminImages = [];
                    for (const image of adminFiles) {
                        const path = crypto.randomUUID() + '.' + ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[image.type]);
                        const { error } = await supabaseClient.storage.from(bucket).upload(path, image, { upsert: false, contentType: image.type });
                        if (error) throw error;
                        uploaded.push(path); newAdminImages.push(path);
                    }
                    record.imagenes_admin = newAdminImages;
                }
                // Conservar un ID estable impide duplicar altas si se pierde la respuesta.
                const targetId = current?.id || newId;
                const existing = await supabaseClient.from('webs_completas').select('id').eq('id', targetId).maybeSingle();
                if (existing.error) throw existing.error;
                saveAttempted = true;
                const query = existing.data ? supabaseClient.from('webs_completas').update(record).eq('id', targetId) : supabaseClient.from('webs_completas').insert({ id: targetId, ...record });
                const { data, error } = await query.select('id').single();
                if (error || !data) throw error || new Error('No se confirmó el guardado.');

                // Si se reemplazaron capturas del panel, retirar las anteriores después de confirmar el guardado.
                if (adminFiles.length && current?.imagenes_admin?.length) {
                    await supabaseClient.storage.from(bucket).remove(current.imagenes_admin).catch(() => {});
                }
                reset(); await refresh(); status.textContent = 'Modelo guardado. Solo las webs publicadas aparecen en la galería.';
            } catch (_) {
                // Si todavía no se intentó guardar, estos archivos sí son huérfanos y pueden retirarse.
                if (uploaded.length && !saveAttempted) await supabaseClient.storage.from(bucket).remove(uploaded).catch(() => {});
                status.textContent = 'No se pudo guardar. Comprueba tu sesión y conexión, y reintenta. Tus datos siguen en el formulario.';
            } finally { loading = false; save.disabled = false; }
        });
        await refresh();
    }
})();
