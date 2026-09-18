/* Operaciones del marketplace con el cliente público y RLS existente. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory;
    else root.TemboraMercado = factory({ cliente: () => supabaseClient, sesion: () => verificarSesion(),
        validar: (...args) => root.TemboraEnvios.validar(...args), uuid: () => crypto.randomUUID() });
})(typeof window !== 'undefined' ? window : globalThis, function(d) {
    'use strict';
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const PUBLIC_FIELDS = 'id,vendedor_id,nombre,descripcion,precio,categoria_id,tecnologias,demo_url,imagen_principal,estado,created_at,ventas,calificacion';
    function ok(r) { if (!r || r.error) throw new Error(r?.error?.message || 'No se pudo completar la consulta.'); return r.data; }
    function id(value) { if (!UUID.test(value || '')) throw new Error('Referencia no válida.'); return value; }
    async function actor(rol, expected) {
        const s = await d.sesion();
        if (!s.success || !s.user || s.rol !== rol) throw new Error('Tu sesión no permite esta operación.');
        if (expected && expected !== s.user.id) throw new Error('La cuenta cambió. Recarga la página.');
        return s.user.id;
    }
    const editable = p => p && (p.estado === 'rechazada' || (p.estado === 'pendiente' && !p.enviada_revision_at));
    async function propia(pid, uid) {
        await actor('vendedor', uid);
        const p = ok(await d.cliente().from('plantillas').select('*').eq('id', id(pid)).eq('vendedor_id', uid).single());
        if (!editable(p)) throw new Error('La plantilla está bloqueada para revisión o ya publicada.');
        return p;
    }
    async function categorias() { return ok(await d.cliente().from('categorias').select('id,nombre').order('nombre')); }
    async function publicadas() {
        // Explicit filter also applies when an owner/admin is browsing the public catalog.
        const rows = [];
        for (let offset = 0; ; offset += 100) {
            const page = ok(await d.cliente().from('plantillas').select(PUBLIC_FIELDS).eq('estado','publicada')
                .order('created_at', {ascending:false}).order('id').range(offset, offset + 99));
            rows.push(...page); if (page.length < 100) return rows;
        }
    }
    async function detalle(pid) {
        return ok(await d.cliente().from('plantillas').select(PUBLIC_FIELDS).eq('id',id(pid)).eq('estado','publicada').maybeSingle());
    }
    async function propias() {
        const uid = await actor('vendedor');
        return ok(await d.cliente().from('plantillas').select('*').eq('vendedor_id',uid).order('created_at',{ascending:false}));
    }
    async function pendientes() {
        await actor('admin');
        return ok(await d.cliente().from('plantillas').select('*').eq('estado','pendiente')
            .not('enviada_revision_at','is',null).order('enviada_revision_at'));
    }
    async function galeria(pid) { return ok(await d.cliente().from('imagenes_plantilla').select('id,url,orden').eq('plantilla_id',id(pid)).order('orden')); }
    async function imagen(path) {
        if (!path) return null;
        return ok(await d.cliente().storage.from('imagenes-plantillas').download(path));
    }
    async function zipRevision(pid) {
        await actor('admin');
        const p = ok(await d.cliente().from('plantillas').select('archivo_zip_path').eq('id',id(pid)).single());
        if (!p.archivo_zip_path) throw new Error('La plantilla no tiene ZIP.');
        return ok(await d.cliente().storage.from('plantillas-zip').download(p.archivo_zip_path));
    }
    async function revisar(pid, estado, motivo) {
        const uid = await actor('admin');
        if (!['publicada','rechazada'].includes(estado)) throw new Error('Estado no válido.');
        if (estado === 'rechazada' && !String(motivo || '').trim()) throw new Error('Indica el motivo del rechazo.');
        await actor('admin',uid);
        ok(await d.cliente().rpc('tembora_revisar_plantilla', {p_plantilla:id(pid),p_estado:estado,p_motivo:motivo?.trim() || null}));
        const p = ok(await d.cliente().from('plantillas').select('id,estado').eq('id',pid).single());
        if (p.estado !== estado) throw new Error('No se confirmó la revisión. Actualiza la lista antes de repetir.');
        return p;
    }
    async function datosValidos(datos) {
        const x = { nombre:String(datos.nombre || '').trim(), descripcion:String(datos.descripcion || '').trim(),
            precio:Number(datos.precio), categoria_id:String(datos.categoria_id || ''),
            tecnologias:String(datos.tecnologias || '').split(',').map(t=>t.trim()).filter(Boolean), demo_url:null };
        if (!x.nombre || x.descripcion.length < 100) throw new Error('Escribe un título y una descripción de al menos 100 caracteres.');
        if (!/^\d+(\.\d{1,2})?$/.test(String(datos.precio)) || !Number.isFinite(x.precio) || x.precio < 20) throw new Error('Precio mínimo S/20, hasta dos decimales.');
        if (!x.tecnologias.length) throw new Error('Indica las tecnologías.');
        if (!(await categorias()).some(c=>String(c.id) === x.categoria_id)) throw new Error('Categoría no disponible.');
        if (String(datos.demo_url || '').trim()) {
            const u = new URL(datos.demo_url);
            if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw new Error('Demo no válida.');
            x.demo_url = u.href;
        }
        return x;
    }
    async function guardar(pid, datos, files, progress = ()=>{}) {
        const uid = await actor('vendedor');
        await propia(pid,uid);
        const cambio = await datosValidos(datos);
        const conArchivos = files && (files.imagenPrincipal || files.archivoZip || files.imagenesAdicionales?.length);
        if (conArchivos) {
            // A full replacement is explicit; old files stay until the new references are confirmed.
            const v = await d.validar(datos,files);
            const root = uid + '/' + pid + '/' + d.uuid();
            const subir = async (bucket,path,file,mime) => {
                await propia(pid,uid);
                ok(await d.cliente().storage.from(bucket).upload(path,file,{contentType:mime,upsert:false}));
            };
            progress('Subiendo archivos corregidos…');
            cambio.imagen_principal = root + '-principal.' + v.principal.ext;
            cambio.archivo_zip_path = root + '-plantilla.zip';
            await subir('imagenes-plantillas',cambio.imagen_principal,v.principal.file,v.principal.mime);
            await subir('plantillas-zip',cambio.archivo_zip_path,v.zip,'application/zip');
            const nuevas = [];
            for (const [i,img] of v.galeria.entries()) {
                const path = root + '-galeria-' + i + '.' + img.ext;
                await subir('imagenes-plantillas',path,img.file,img.mime);
                nuevas.push({plantilla_id:pid,url:path,orden:i});
            }
            await propia(pid,uid);
            const anteriores = await galeria(pid);
            if (nuevas.length) ok(await d.cliente().from('imagenes_plantilla').insert(nuevas));
            if (anteriores.length) ok(await d.cliente().from('imagenes_plantilla').delete().eq('plantilla_id',pid).in('id',anteriores.map(i=>i.id)));
        }
        await propia(pid,uid);
        ok(await d.cliente().from('plantillas').update(cambio).eq('id',pid).eq('vendedor_id',uid).select('id').single());
        // Do not remove files automatically: another device may still be saving its references.
        return propia(pid,uid);
    }
    async function limpiarArchivos(pid,uid,todos) {
        const p = await propia(pid,uid), imgs = await galeria(pid);
        const referencias = new Set([p.imagen_principal,p.archivo_zip_path,...imgs.map(i=>i.url)]);
        const prefix = uid + '/' + pid;
        for (const bucket of ['imagenes-plantillas','plantillas-zip']) {
            const objects = ok(await d.cliente().storage.from(bucket).list(prefix,{limit:1000}));
            if (objects.length >= 1000) throw new Error('Demasiados archivos para la limpieza automática.');
            const paths = objects.map(o=> {
                if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|zip)$/.test(o.name)) throw new Error('Archivo no reconocido; requiere revisión.');
                return prefix + '/' + o.name;
            }).filter(path=>todos || !referencias.has(path));
            await propia(pid,uid);
            if (paths.length) ok(await d.cliente().storage.from(bucket).remove(paths));
        }
    }
    async function retirar(pid) {
        const uid = await actor('vendedor');
        await limpiarArchivos(id(pid),uid,true);
        await propia(pid,uid);
        ok(await d.cliente().from('plantillas').delete().eq('id',pid).eq('vendedor_id',uid).select('id').single());
    }
    async function enviar(pid) {
        const uid = await actor('vendedor'), p = await propia(pid,uid);
        await datosValidos({...p,tecnologias:(p.tecnologias || []).join(',')});
        const images = await galeria(pid);
        if (images.length > 5) throw new Error('La galería tiene más de cinco imágenes. Guarda nuevamente los archivos corregidos antes de enviar.');
        await propia(pid,uid);
        ok(await d.cliente().rpc('tembora_enviar_plantilla',{p_plantilla:id(pid)}));
        const row = ok(await d.cliente().from('plantillas').select('id,estado,enviada_revision_at').eq('id',pid).eq('vendedor_id',uid).single());
        if (row.estado !== 'pendiente' || !row.enviada_revision_at) throw new Error('No se confirmó el envío. Actualiza la lista.');
        return row;
    }
    async function limpiarObsoletos(pid) {
        const uid=await actor('vendedor');await propia(pid,uid);
        const marked=ok(await d.cliente().rpc('tembora_marcar_obsoletos',{p_plantilla:id(pid)}));
        for(const bucket of ['imagenes-plantillas','plantillas-zip']) {
            const paths=marked.filter(x=>x.bucket===bucket).map(x=>x.ruta);
            if(!paths.length)continue;
            if(paths.some(p=>!p.startsWith(uid+'/'+pid+'/')))throw new Error('Ruta de limpieza inesperada.');
            await propia(pid,uid);
            for(let n=0;n<paths.length;n+=100)ok(await d.cliente().storage.from(bucket).remove(paths.slice(n,n+100)));
            const remaining=ok(await d.cliente().storage.from(bucket).list(uid+'/'+pid,{limit:1000}));
            if(remaining.length>=1000 || remaining.some(x=>paths.includes(uid+'/'+pid+'/'+x.name)))throw new Error('La limpieza no se confirmó completamente. Puedes reintentar.');
        }
        return marked.length;
    }
    async function favoritos() {
        const uid = await actor('comprador');
        return ok(await d.cliente().from('favoritos').select('id,plantilla_id').eq('usuario_id',uid));
    }
    async function favorito(pid, agregar) {
        const uid = await actor('comprador'); id(pid);
        if (agregar) {
            if (!await detalle(pid)) throw new Error('La plantilla ya no está publicada.');
            const existentes = await favoritos();
            if (existentes.some(x=>x.plantilla_id === pid)) return;
            ok(await d.cliente().from('favoritos').insert({usuario_id:uid,plantilla_id:pid}));
        } else ok(await d.cliente().from('favoritos').delete().eq('usuario_id',uid).eq('plantilla_id',pid));
    }
    async function pedidos() {
        const uid = await actor('comprador');
        return ok(await d.cliente().from('pedidos').select('id,plantilla_id,monto,estado_pago,created_at').eq('comprador_id',uid).order('created_at',{ascending:false}));
    }
    async function usuarios() {
        await actor('admin');const rows=[];
        for(let n=0;;n+=100) {
            const page=ok(await d.cliente().from('perfiles').select('id,nombre_completo,rol,created_at').order('created_at').order('id').range(n,n+99));
            rows.push(...page);if(page.length<100)return rows;
        }
    }
    async function cambiarRol(uid,rol) {
        const me=await actor('admin');
        if(uid===me || !['comprador','vendedor','admin'].includes(rol))throw new Error('Cambio de rol no permitido.');
        ok(await d.cliente().rpc('tembora_admin_cambiar_rol',{p_usuario_id:id(uid),p_nuevo_rol:rol}));
    }
    async function perfilPublico(uid) {
        return ok(await d.cliente().from('perfiles').select('id,nombre_completo,bio').eq('id',id(uid)).eq('rol','vendedor').maybeSingle());
    }
    async function miPerfil(cambios) {
        const s=await d.sesion();if(!s.success || !s.user?.id)throw new Error('Inicia sesión para consultar tu perfil.');
        if(cambios) {
            const nombre=String(cambios.nombre_completo || '').trim(),bio=String(cambios.bio || '').trim();
            if(!nombre || nombre.length>120 || bio.length>2000)throw new Error('Nombre requerido (hasta 120 caracteres) y biografía de hasta 2000 caracteres.');
            ok(await d.cliente().from('perfiles').update({nombre_completo:nombre,bio}).eq('id',s.user.id).select('id').single());
        }
        return ok(await d.cliente().from('perfiles').select('id,nombre_completo,bio,rol').eq('id',s.user.id).single());
    }
    return { categorias, publicadas, detalle, propias, pendientes, galeria, imagen, zipRevision, revisar,
        guardar, enviar, retirar, limpiarObsoletos, favoritos, favorito, pedidos, editable, datosValidos,
        usuarios, cambiarRol, perfilPublico, miPerfil };
});
