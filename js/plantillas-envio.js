/* Envío de plantillas. Solo usa el cliente público y las reglas del Bloque 1. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory;
    else root.TemboraEnvios = factory({
        cliente: () => supabaseClient,
        sesion: () => verificarSesion(),
        memoria: {
            getItem: key => window.localStorage.getItem(key),
            setItem: (key, value) => window.localStorage.setItem(key, value),
            removeItem: key => window.localStorage.removeItem(key)
        },
        uuid: () => crypto.randomUUID(),
        locks: navigator.locks,
        comprobarImagen: async file => {
            const url = URL.createObjectURL(file);
            try {
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => img.naturalWidth && img.naturalHeight ? resolve() : reject(new Error('Imagen inválida'));
                    img.onerror = () => reject(new Error('Imagen inválida'));
                    img.src = url;
                });
            } finally { URL.revokeObjectURL(url); }
        }
    });
})(typeof window !== 'undefined' ? window : globalThis, function (deps) {
    'use strict';
    const MAX_IMAGE = 5 * 1024 * 1024, MAX_ZIP = 50 * 1024 * 1024;
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let ocupado = false;
    const mensajeError = (message, cause) => Object.assign(new Error(message), { cause });
    function revisar(r, mensaje) {
        if (!r || r.error) throw mensajeError(mensaje, r?.error);
        return r.data;
    }
    async function vendedor() {
        const s = await deps.sesion();
        if (!s.success || !s.user?.id) throw new Error('Tu sesión no está disponible. Vuelve a iniciar sesión.');
        if (s.rol !== 'vendedor') throw new Error('Solo una cuenta vendedor puede enviar plantillas.');
        return s.user.id;
    }
    async function mismaCuenta(uid) {
        if (await vendedor() !== uid) throw new Error('La cuenta cambió durante el envío. No se continuará con otra cuenta.');
    }
    const clave = uid => 'tembora:envio:' + uid;
    function recordar(uid, value) {
        try { deps.memoria.setItem(clave(uid), JSON.stringify(value)); }
        catch (_) { throw new Error('No se puede guardar la referencia del envío en este navegador. Habilita el almacenamiento local antes de enviar.'); }
    }
    function pendiente(uid) {
        const raw = deps.memoria.getItem(clave(uid));
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!UUID.test(p.id)) throw new Error('La referencia del envío no es válida. Contacta con soporte.');
        return p;
    }
    function olvidar(uid) { deps.memoria.removeItem(clave(uid)); }
    async function exclusivo(fn) {
        if (ocupado) return { success: false, ocupado: true, error: 'Ya hay un envío en curso.' };
        ocupado = true;
        try {
            if (deps.locks) return await deps.locks.request('tembora-envio-plantillas', { ifAvailable: true }, lock =>
                lock ? fn() : { success: false, ocupado: true, error: 'Hay un envío abierto en otra pestaña. Espera a que termine.' });
            return await fn();
        } catch (e) { return { success: false, error: e.message || 'No se pudo completar la operación.' }; }
        finally { ocupado = false; }
    }
    async function categorias() {
        const data = revisar(await deps.cliente().from('categorias').select('id,nombre').order('nombre'),
            'No se pudieron cargar las categorías. Reintenta.');
        if (!data?.length) throw new Error('No hay categorías disponibles para enviar plantillas.');
        return data;
    }
    async function imagen(file, etiqueta) {
        if (!file || !file.size) throw new Error(etiqueta + ': selecciona un archivo no vacío.');
        if (file.size > MAX_IMAGE) throw new Error(etiqueta + ': el máximo es 5 MB.');
        const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        let tipo;
        if (h[0] === 255 && h[1] === 216 && h[2] === 255) tipo = { ext: 'jpg', mime: 'image/jpeg', names: /\.jpe?g$/i };
        if ([137,80,78,71,13,10,26,10].every((v,i) => h[i] === v)) tipo = { ext: 'png', mime: 'image/png', names: /\.png$/i };
        if (String.fromCharCode(...h.slice(0,4)) === 'RIFF' && String.fromCharCode(...h.slice(8,12)) === 'WEBP')
            tipo = { ext: 'webp', mime: 'image/webp', names: /\.webp$/i };
        if (!tipo || !tipo.names.test(file.name) || (file.type && file.type !== tipo.mime))
            throw new Error(etiqueta + ': utiliza una imagen JPG, PNG o WebP válida.');
        if (deps.comprobarImagen) {
            try { await deps.comprobarImagen(file); }
            catch (_) { throw new Error(etiqueta + ': no se pudo abrir la imagen. Elige otra.'); }
        }
        return { file, ...tipo };
    }
    async function validar(datos, files) {
        const nombre = String(datos.nombre || '').trim();
        const descripcion = String(datos.descripcion || '').trim();
        const precioTexto = String(datos.precio ?? '').trim();
        const precio = Number(precioTexto);
        if (!nombre) throw new Error('Escribe el título de la plantilla.');
        if (descripcion.length < 100) throw new Error('La descripción debe tener al menos 100 caracteres.');
        if (!/^\d+(\.\d{1,2})?$/.test(precioTexto) || !Number.isFinite(precio) || precio < 20)
            throw new Error('El precio mínimo es S/20 y admite hasta dos decimales.');
        const tecnologias = (Array.isArray(datos.tecnologias) ? datos.tecnologias : String(datos.tecnologias || '').split(','))
            .map(t => String(t).trim()).filter(Boolean);
        if (!tecnologias.length) throw new Error('Indica las tecnologías utilizadas.');
        const categoria = String(datos.categoria_id || '');
        if (!/^\d+$/.test(categoria)) throw new Error('Selecciona una categoría.');
        let demo = null;
        if (String(datos.demo_url || '').trim()) {
            let u;
            try { u = new URL(String(datos.demo_url).trim()); } catch (_) { throw new Error('La URL de demo no es válida.'); }
            if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
                throw new Error('La demo debe ser una URL HTTP o HTTPS sin credenciales.');
            demo = u.href;
        }
        const adicionales = Array.from(files.imagenesAdicionales || []);
        if (adicionales.length > 5) throw new Error('Puedes subir como máximo 5 imágenes adicionales.');
        const principal = await imagen(files.imagenPrincipal, 'Imagen principal');
        const galeria = [];
        for (const [i, file] of adicionales.entries()) galeria.push(await imagen(file, 'Imagen adicional ' + (i + 1)));
        const zip = files.archivoZip;
        if (!zip?.size || zip.size > MAX_ZIP || !/\.zip$/i.test(zip.name))
            throw new Error('Selecciona un archivo ZIP no vacío de hasta 50 MB.');
        const h = new Uint8Array(await zip.slice(0, 4).arrayBuffer());
        if (h[0] !== 80 || h[1] !== 75 || h[2] !== 3 || h[3] !== 4 ||
            (zip.type && !['application/zip','application/x-zip-compressed','application/octet-stream'].includes(zip.type)))
            throw new Error('El archivo no tiene un formato ZIP compatible o está vacío.');
        // Verify the directory/footer without extracting or executing untrusted code.
        const tail = new Uint8Array(await zip.slice(Math.max(0, zip.size - 65557)).arrayBuffer());
        const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
        let end = -1;
        for (let i = tail.length - 22; i >= 0; i--) {
            if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === tail.length) { end = i; break; }
        }
        if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 ||
            view.getUint16(end + 10, true) === 0 || view.getUint16(end + 10, true) === 65535 ||
            view.getUint16(end + 8, true) !== view.getUint16(end + 10, true) ||
            view.getUint32(end + 12, true) < 46 ||
            view.getUint32(end + 16, true) + view.getUint32(end + 12, true) !== zip.size - tail.length + end)
            throw new Error('El ZIP está incompleto o usa un formato no compatible. Utiliza un ZIP estándar, completo y de una sola parte.');
        const directory = new Uint8Array(await zip.slice(view.getUint32(end + 16, true), view.getUint32(end + 16, true) + 4).arrayBuffer());
        if (directory[0] !== 80 || directory[1] !== 75 || directory[2] !== 1 || directory[3] !== 2)
            throw new Error('El directorio del ZIP no es válido. Vuelve a comprimir los archivos.');
        return { datos: { nombre, descripcion, precio, tecnologias, categoria_id: categoria, demo_url: demo }, principal, galeria, zip };
    }
    async function leer(uid, id) {
        await mismaCuenta(uid);
        return revisar(await deps.cliente().from('plantillas')
            .select('id,nombre,estado,enviada_revision_at,motivo_rechazo')
            .eq('id', id).eq('vendedor_id', uid).maybeSingle(), 'No se pudo comprobar el estado del envío.');
    }
    const enviada = row => !!row && ['pendiente','publicada','rechazada'].includes(row.estado) &&
        typeof row.enviada_revision_at === 'string' && Number.isFinite(Date.parse(row.enviada_revision_at));
    function resultado(row) {
        return { success: true, plantilla: row, message: row.estado === 'pendiente'
            ? 'Plantilla enviada. Estado: pendiente de aprobación. Sus datos y archivos están bloqueados para revisión.'
            : 'Estado actual de la plantilla: ' + row.estado + '.' };
    }
    // Remove only files inside this attempt's own folder, then the parent.
    // The server prevents deleting files/parent if submission won a concurrent race.
    async function limpiar(uid, id) {
        await mismaCuenta(uid);
        const row = await leer(uid, id);
        if (enviada(row)) return { conservada: true, plantilla: row };
        const root = uid + '/' + id;
        for (const bucket of ['imagenes-plantillas', 'plantillas-zip']) {
            await mismaCuenta(uid);
            const objetos = revisar(await deps.cliente().storage.from(bucket).list(root, { limit: 100 }),
                'No se pudieron comprobar los archivos para limpiar la preparación.');
            if ((objetos || []).length >= 100) throw new Error('Hay demasiados archivos para una limpieza automática segura.');
            const paths = (objetos || []).map(o => {
                if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|zip)$/.test(o.name))
                    throw new Error('Se encontró un archivo que requiere revisión antes de eliminarlo.');
                return root + '/' + o.name;
            });
            if (paths.length) revisar(await deps.cliente().storage.from(bucket).remove(paths), 'No se pudieron retirar todos los archivos.');
            const quedan = revisar(await deps.cliente().storage.from(bucket).list(root, { limit: 1 }), 'No se pudo confirmar la limpieza.');
            if (quedan?.length) throw new Error('Quedan archivos en la preparación. No se eliminó su registro.');
        }
        await mismaCuenta(uid);
        revisar(await deps.cliente().from('plantillas').delete().eq('id', id).eq('vendedor_id', uid)
            .eq('estado', 'pendiente').is('enviada_revision_at', null).select('id'), 'No se pudo eliminar la preparación.');
        const restante = await leer(uid, id);
        if (restante) {
            if (enviada(restante)) return { conservada: true, plantilla: restante };
            throw new Error('La preparación continúa guardada. Reintenta la limpieza.');
        }
        olvidar(uid);
        return { limpia: true };
    }
    function definitivo(e) {
        const c = e.cause;
        return !!c && ((/^[0-9A-Z]{5}$/.test(c.code || '') && c.code !== 'PGRST') ||
            (Number(c.statusCode || c.status) >= 400 && Number(c.statusCode || c.status) < 500 &&
             ![408,429].includes(Number(c.statusCode || c.status))));
    }
    async function crear(datos, files, onProgress = () => {}) {
        return exclusivo(async () => {
            const uid = await vendedor();
            const anterior = pendiente(uid);
            if (anterior) return { success: false, recuperable: true, id: anterior.id,
                error: 'Hay un envío anterior guardado. Comprueba su estado antes de crear otro.' };
            const progreso = texto => { try { onProgress(texto); } catch (_) { /* UI cannot change the transaction outcome. */ } };
            progreso('Validando información y archivos…');
            const validado = await validar(datos, files);
            const cats = await categorias();
            if (!cats.some(c => String(c.id) === validado.datos.categoria_id)) throw new Error('La categoría seleccionada ya no está disponible.');
            await mismaCuenta(uid);
            const id = deps.uuid(), root = uid + '/' + id;
            let rpcIntentado = false;
            // A durable reference prevents accidental duplicate submission after reload.
            // It stores only an operation UUID, never a file, password or token.
            recordar(uid, { id });
            try {
                progreso('Creando preparación privada…');
                const creada = revisar(await deps.cliente().from('plantillas').insert({ id, vendedor_id: uid, ...validado.datos })
                    .select('id').single(), 'No se pudo crear la preparación.');
                if (creada?.id !== id) throw new Error('No se pudo confirmar la preparación creada.');
                const subir = async (bucket, path, file, mime) => {
                    await mismaCuenta(uid);
                    revisar(await deps.cliente().storage.from(bucket).upload(path, file, { contentType: mime, upsert: false }),
                        'No se pudo subir el archivo. Comprueba tu conexión y los límites permitidos.');
                };
                const principal = root + '/principal.' + validado.principal.ext;
                progreso('Subiendo imagen principal…');
                await subir('imagenes-plantillas', principal, validado.principal.file, validado.principal.mime);
                const galeria = [];
                for (const [i, img] of validado.galeria.entries()) {
                    progreso('Subiendo imagen adicional ' + (i + 1) + ' de ' + validado.galeria.length + '…');
                    const path = root + '/galeria-' + (i + 1) + '.' + img.ext;
                    await subir('imagenes-plantillas', path, img.file, img.mime);
                    galeria.push({ plantilla_id: id, url: path, orden: i });
                }
                const zip = root + '/plantilla.zip';
                progreso('Subiendo ZIP privado (puede tardar unos minutos)…');
                await subir('plantillas-zip', zip, validado.zip, 'application/zip');
                await mismaCuenta(uid);
                progreso('Guardando datos de los archivos…');
                const guardada = revisar(await deps.cliente().from('plantillas')
                    .update({ imagen_principal: principal, archivo_zip_path: zip })
                    .eq('id', id).eq('vendedor_id', uid).select('id').single(),
                    'No se pudieron guardar las rutas de los archivos.');
                if (!guardada?.id) throw new Error('No se confirmó el registro de los archivos.');
                if (galeria.length) revisar(await deps.cliente().from('imagenes_plantilla').insert(galeria),
                    'No se pudo guardar la galería completa.');
                await mismaCuenta(uid);
                progreso('Enviando a revisión…');
                rpcIntentado = true;
                revisar(await deps.cliente().rpc('tembora_enviar_plantilla', { p_plantilla: id }),
                    'No se pudo confirmar el envío a revisión.');
                const row = await leer(uid, id);
                if (!enviada(row)) throw new Error('El servidor todavía no confirmó la recepción del envío.');
                return resultado(row);
            } catch (e) {
                // A lost RPC/upload response can still commit on the server.
                // Do not delete a possibly accepted or still-running operation.
                if (rpcIntentado || !definitivo(e)) return { success: false, recuperable: true, id,
                    error: e.message + ' Conservamos la referencia; comprueba el estado antes de reintentar.' };
                progreso('El envío falló. Retirando la preparación incompleta…');
                try {
                    const cleanup = await limpiar(uid, id);
                    if (cleanup.conservada) return resultado(cleanup.plantilla);
                    return { success: false, error: e.message + ' Se retiró la preparación incompleta. Puedes reintentar.' };
                } catch (_) {
                    return { success: false, recuperable: true, id,
                        error: e.message + ' La limpieza no pudo completarse. Comprueba el estado y reintenta retirar la preparación.' };
                }
            }
        });
    }
    async function comprobar() {
        return exclusivo(async () => {
            const uid = await vendedor(), p = pendiente(uid);
            if (!p) return { success: true, vacio: true };
            const row = await leer(uid, p.id);
            if (enviada(row)) return resultado(row);
            return { success: false, recuperable: true, preparada: !!row, id: p.id,
                error: row ? 'La preparación está guardada, pero no se ha enviado a revisión. Puedes retirarla y volver a enviar.'
                    : 'Todavía no se puede confirmar la preparación. Reintenta comprobar el estado antes de descartarla.' };
        });
    }
    async function descartar() {
        return exclusivo(async () => {
            const uid = await vendedor(), p = pendiente(uid);
            if (!p) return { success: true, vacio: true };
            const res = await limpiar(uid, p.id);
            return res.conservada ? resultado(res.plantilla) : { success: true, vacio: true, message: 'Preparación retirada. Puedes volver a enviar.' };
        });
    }
    async function nuevo() {
        return exclusivo(async () => {
            const uid = await vendedor(), p = pendiente(uid);
            if (p && !enviada(await leer(uid, p.id))) throw new Error('Comprueba o retira el envío pendiente antes de crear otro.');
            olvidar(uid);
            return { success: true, vacio: true };
        });
    }
    return { crear, categorias, validar, validarImagen: imagen, comprobar, descartar, nuevo };
});
