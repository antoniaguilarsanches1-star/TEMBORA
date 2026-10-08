/* DOM seguro: los textos de vendedores se muestran como texto, nunca como HTML. */
(function() {
    'use strict';
    const api = window.TemboraMercado;
    const pay = window.TemboraPagos;
    let area, status, busy = false, cats = [], urls = [], generation = 0;
    const mode = document.body.dataset.market;
    let refreshOrders=null, refreshing=false, paymentChannel;
    try {
        if(typeof BroadcastChannel!=='undefined') {
            paymentChannel=new BroadcastChannel('tembora-pagos');
            paymentChannel.onmessage=()=>syncOrders();
        }
    } catch(_) { /* La consulta periódica también funciona sin canal entre pestañas. */ }
    async function syncOrders() {
        if(!refreshOrders || refreshing || busy || document.hidden) return;
        const revision=generation, refresh=refreshOrders;
        refreshing=true;
        try { await refresh(()=>revision===generation && !busy); }
        catch(_) { if(revision===generation) notice('No se pudo actualizar el pedido. Reintentando la consulta…'); }
        finally { refreshing=false; }
    }
    window.addEventListener('focus',syncOrders);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOrders();});
    if(typeof setInterval==='function') setInterval(syncOrders,3000);
    const el = (tag,text,cls) => { const e=document.createElement(tag); if(text !== undefined) e.textContent=text; if(cls) e.className=cls; return e; };
    const money = n => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(n));
    const state = p => p.estado === 'pendiente' && !p.enviada_revision_at ? 'En preparación' : ({pendiente:'Pendiente de aprobación',publicada:'Publicada',rechazada:'Rechazada'}[p.estado] || p.estado);
    function notice(text) { status.textContent=text; }
    function link(text,href) { const a=el('a',text,'btn btn-outline btn-sm'); a.href=href; return a; }
    function safeURL(value) { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch (_) { return null; } }
    function clear() { generation++; refreshOrders=null; urls.forEach(u=>URL.revokeObjectURL(u)); urls=[]; area.replaceChildren(); }
    function button(text,fn,parent=area) {
        const b=el('button',text,'btn btn-outline btn-sm'); b.type='button';
        b.addEventListener('click',()=>action(fn)); parent.append(b); return b;
    }
    async function action(fn) {
        if(busy) return;
        const run=async()=> {
            busy=true; document.querySelectorAll('#market-root button, #market-root input, #market-root textarea, #market-root select').forEach(b=>b.disabled=true);
            notice('Procesando…');
            try { await fn(); }
            catch(e) { notice((e.message || 'No se pudo completar la operación.') + ' Actualiza para comprobar el estado antes de repetir.'); }
            finally { busy=false; document.querySelectorAll('#market-root button, #market-root input, #market-root textarea, #market-root select').forEach(b=>b.disabled=false); }
        };
        if(navigator.locks) await navigator.locks.request('tembora-envio-plantillas',{ifAvailable:true},async lock=> {
            if(lock) await run(); else notice('Hay otra operación abierta en otra pestaña. Espera a que termine.');
        }); else await run();
    }
    async function photo(path,parent) {
        if(!path) return;
        const current=generation;
        try {
            const blob=await api.imagen(path); if(current!==generation || !parent.isConnected) return;
            const url=URL.createObjectURL(blob); urls.push(url);
            const img=el('img'); img.src=url; img.alt='Vista de la plantilla'; img.loading='lazy'; img.style.maxWidth='100%'; parent.append(img);
        } catch(_) { if(current===generation) parent.append(el('p','Imagen no disponible. Actualiza para reintentar.')); }
    }
    function card(p,parent=area) {
        const c=el('article',undefined,'template-card'); const content=el('div',undefined,'template-content');
        content.append(el('h3',p.nombre),el('p',money(p.precio)),el('p',cats.find(x=>String(x.id)===String(p.categoria_id))?.nombre || 'Sin categoría'));
        c.append(content); parent.append(c); return content;
    }
    function description(p,parent) {
        const desc=el('p',p.descripcion); desc.style.whiteSpace='pre-wrap'; parent.append(desc,el('p',(p.tecnologias || []).join(', ')));
        const demo=safeURL(p.demo_url);
        if(demo) { const a=link('Abrir demo externa',demo); a.target='_blank'; a.rel='noopener noreferrer'; parent.append(a); }
    }
    async function preview(p,parent) {
        await photo(p.imagen_principal,parent);
        for(const img of await api.galeria(p.id)) await photo(img.url,parent);
    }
    const savedCorrections=new Map();
    function sellerView(title,section='plantillas') {
        viewTitle(title);
        window.TavikuSellerShell?.select(section);
    }
    function templateBadge(p) {
        return el('span',p.estado==='pendiente' && p.enviada_revision_at?'Pendiente de revisión':state(p),'seller-badge seller-'+p.estado);
    }
    function rejection(p,parent) {
        if(p.motivo_rechazo) {
            const box=el('div',undefined,'seller-rejection');box.append(el('strong','Motivo de rechazo'),el('p',p.motivo_rechazo));parent.append(box);
        }
    }
    function correctionSaved(p) {
        return p.estado!=='rechazada' || savedCorrections.get(p.id)===(p.revisada_at || p.motivo_rechazo || p.id) ||
            (Number.isFinite(Date.parse(p.revisada_at)) && Date.parse(p.updated_at)>Date.parse(p.revisada_at));
    }
    function sellerActions(p,parent) {
        if(!api.editable(p))return;
        button('Editar / corregir',()=>editor(p),parent);
        if(correctionSaved(p))button('Enviar a revisión',async()=> {
            if(!confirm('Al enviar esta versión, quedará bloqueada hasta que el administrador la apruebe o rechace. ¿Deseas continuar?'))return;
            await api.enviar(p.id);savedCorrections.delete(p.id);await seller();notice('Enviada: pendiente de revisión.');
        },parent);
        else parent.append(el('p','Guarda una corrección válida para habilitar el envío a revisión.','seller-help'));
        button('Retirar plantilla',async()=>{
            if(!confirm('¿Eliminar esta preparación o plantilla rechazada y sus archivos? Esta acción no se puede deshacer.'))return;
            await api.retirar(p.id);
            try {const key='tembora:envio:'+p.vendedor_id;if(JSON.parse(localStorage.getItem(key)||'null')?.id===p.id)localStorage.removeItem(key);}catch(_){}
            savedCorrections.delete(p.id);await seller();notice('Plantilla retirada.');
        },parent);
    }
    async function templateGallery(p,parent) {
        const gallery=el('div',undefined,'seller-gallery'),main=el('div',undefined,'seller-gallery-main'),thumbs=el('div',undefined,'seller-thumbnails');
        gallery.append(main,thumbs);parent.append(gallery);
        await photo(p.imagen_principal,main);
        const images=await api.galeria(p.id);
        if(!gallery.isConnected)return;
        if(images.length) {
            for(const [index,path] of [p.imagen_principal,...images.map(i=>i.url)].filter(Boolean).entries()) {
                const thumb=el('button',undefined,'seller-thumbnail');thumb.type='button';thumb.setAttribute('aria-label',index===0?'Ver imagen principal':'Ver imagen adicional '+index);
                thumb.addEventListener('click',()=>{const img=thumb.querySelector('img');if(img){main.replaceChildren(img.cloneNode());thumbs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===thumb)));}});
                thumb.setAttribute('aria-pressed',String(index===0));thumbs.append(thumb);await photo(path,thumb);
            }
        }
    }
    function templateInfo(p,parent) {
        parent.append(templateBadge(p),el('h2',p.nombre),el('p',money(p.precio),'seller-price'),el('p',cats.find(c=>String(c.id)===String(p.categoria_id))?.nombre || 'Sin categoría'),el('p','Referencia: '+shortRef(p.id),'seller-help'));
        description(p,parent);rejection(p,parent);
    }
    async function sellerDetail(p) {
        clear();sellerView('Detalle de plantilla');
        const info=el('section',undefined,'seller-surface');area.append(info);templateInfo(p,info);
        if(!api.editable(p))info.append(el('p','Sus datos y archivos permanecen bloqueados mientras esté en revisión o publicada.','seller-help'));
        await templateGallery(p,info);const controls=el('div',undefined,'seller-actions');info.append(controls);sellerActions(p,controls);
        button('Volver a Mis plantillas',seller);notice('');
    }
    async function seller() {
        const rows=await api.propias();clear();sellerView('Mis plantillas');
        const summary=el('div',undefined,'seller-summary');
        for(const [key,title] of [['publicada','Publicadas'],['pendiente','Pendientes'],['rechazada','Rechazadas']]){
            const box=el('div',undefined,'seller-surface');box.append(el('span',title),el('strong',String(rows.filter(p=>p.estado===key && (key!=='pendiente'||p.enviada_revision_at)).length)));summary.append(box);
        }
        area.append(summary);
        if(!rows.length)area.append(el('p','Todavía no tienes plantillas. Agrega tu primera plantilla para enviarla a revisión.','seller-empty'));
        const grid=el('div',undefined,'seller-grid');area.append(grid);
        for(const p of rows){
            const c=el('article',undefined,'seller-surface'),image=el('div',undefined,'seller-cover');grid.append(c);c.append(image);photo(p.imagen_principal,image);
            c.append(el('h2',p.nombre),el('p',money(p.precio),'seller-price'),el('p',cats.find(x=>String(x.id)===String(p.categoria_id))?.nombre || 'Sin categoría'),templateBadge(p),el('p','Referencia: '+shortRef(p.id),'seller-help'));rejection(p,c);
            const controls=el('div',undefined,'seller-actions');c.append(controls);button('Ver información',()=>sellerDetail(p),controls);sellerActions(p,controls);
        }
        notice('Tienes '+rows.length+' plantillas. Las plantillas enviadas a revisión o publicadas permanecen bloqueadas según su estado.');
    }
    function field(form,label,name,value,type='text') {
        const box=el('div',undefined,'form-group'), l=el('label',label);
        const input=el(type==='textarea'?'textarea':'input'); input.id='edit-'+name; input.name=name;
        l.htmlFor=input.id; if(type!=='textarea') input.type=type;
        if(type!=='file') input.value=value ?? ''; box.append(l,input); form.append(box); return input;
    }
    async function editor(p) {
        clear();sellerView('Corregir plantilla');area.append(templateBadge(p),el('h2',p.nombre));rejection(p,area);
        const form=el('form',undefined,'seller-surface seller-editor'), inputs={};
        inputs.nombre=field(form,'Título','nombre',p.nombre); inputs.nombre.required=true;
        inputs.descripcion=field(form,'Descripción (mínimo 100 caracteres)','descripcion',p.descripcion,'textarea'); inputs.descripcion.minLength=100; inputs.descripcion.required=true;
        inputs.precio=field(form,'Precio (S/)','precio',p.precio,'number'); inputs.precio.min=20; inputs.precio.step='0.01'; inputs.precio.required=true;
        const label=el('label','Categoría'); label.htmlFor='edit-categoria'; inputs.categoria_id=el('select'); inputs.categoria_id.id='edit-categoria';
        for(const c of cats) inputs.categoria_id.add(new Option(c.nombre,String(c.id)));
        inputs.categoria_id.value=String(p.categoria_id); form.append(label,inputs.categoria_id);
        inputs.tecnologias=field(form,'Tecnologías separadas por comas','tecnologias',(p.tecnologias || []).join(', ')); inputs.tecnologias.required=true;
        inputs.demo_url=field(form,'Demo (opcional)','demo_url',p.demo_url,'url');
        form.append(el('p','Deja estos campos vacíos para conservar los archivos actuales. Selecciona nuevos archivos solo si deseas reemplazarlos. Para reemplazar, adjunta imagen principal y ZIP, junto con las imágenes adicionales que deseas conservar.'));
        const principal=field(form,'Imagen principal (máximo 5 MB)','principal',null,'file'); principal.accept='.jpg,.jpeg,.png,.webp';
        const gallery=field(form,'Hasta 5 imágenes adicionales (5 MB cada una)','galeria',null,'file'); gallery.multiple=true; gallery.accept=principal.accept;
        const zip=field(form,'ZIP privado (máximo 50 MB)','zip',null,'file'); zip.accept='.zip';
        const save=el('button','Guardar corrección','btn btn-primary'); save.type='submit'; form.append(save); area.append(form);
        form.addEventListener('submit',e=> {
            e.preventDefault(); if(!form.reportValidity()) return;
            const datos=Object.fromEntries(Object.entries(inputs).map(([k,input])=>[k,input.value]));
            const files={imagenPrincipal:principal.files[0],imagenesAdicionales:Array.from(gallery.files),archivoZip:zip.files[0]};
            action(async()=> { await api.guardar(p.id,datos,files,notice);savedCorrections.set(p.id,p.revisada_at || p.motivo_rechazo || p.id); await seller(); notice('Corrección guardada. Puedes enviarla a revisión.'); });
        });
        button('Volver sin guardar',seller); notice('Puedes editar esta plantilla. Guardar no la publica ni la envía.');
    }
    function reviewNav(active='revision') {
        const nav=document.getElementById('admin-nav') || el('nav',undefined,'review-nav');nav.replaceChildren();nav.setAttribute('aria-label','Administración');
        if(!document.getElementById('admin-nav'))area.append(nav);
        for(const [key,label,fn] of [['revision','Revisión de plantillas',admin],['pagos','Pagos y ventas',pagosAdmin],['retiros','Solicitudes de retiro',retirosAdmin],['yape','Configurar Yape',configurarYape],['usuarios','Usuarios',usuarios],['perfil','Mi perfil',perfil]]){
            const b=button(label,fn,nav);if(key===active)b.setAttribute('aria-current','page');
        }
    }
    function adminView(title,section) {
        viewTitle(title);reviewNav(section);
        if(typeof history!=='undefined')history.replaceState(null,'','admin.html?vista='+section);
    }
    async function adminNames() {
        try {return new Map((await api.usuarios()).map(p=>[p.id,p.nombre_completo || shortRef(p.id)]));}catch(_){return new Map();}
    }
    function adminInfo(text) {area.append(el('p',text,'admin-info'));}

    async function vendorName(p,parent) {
        const name=el('p','Vendedor · '+shortRef(p.vendedor_id),'seller-help');parent.append(name);
        try {const profile=await api.perfilPublico(p.vendedor_id);if(name.isConnected && profile?.nombre_completo)name.textContent='Vendedor: '+profile.nombre_completo;}catch(_){}
    }
    async function admin() {
        const rows=await api.pendientes();clear();adminView('Revisión de plantillas','revision');
        if(!rows.length)area.append(el('p','No hay plantillas pendientes de revisión.','seller-empty'));
        const grid=el('div',undefined,'seller-grid');area.append(grid);
        for(const p of rows){
            const c=el('article',undefined,'seller-surface'),image=el('div',undefined,'seller-cover');grid.append(c);c.append(image);photo(p.imagen_principal,image);
            c.append(el('h2',p.nombre),templateBadge(p),el('p',money(p.precio),'seller-price'),el('p',cats.find(x=>String(x.id)===String(p.categoria_id))?.nombre || 'Sin categoría'),el('p',(p.tecnologias || []).join(', ')),el('p',p.descripcion,'review-description'),el('p','Referencia: '+shortRef(p.id),'seller-help'),el('p','Enviada: '+dateText(p.enviada_revision_at)));
            vendorName(p,c);const demo=safeURL(p.demo_url);if(demo){const l=link('Ver demo',demo);l.target='_blank';l.rel='noopener noreferrer';c.append(l);}
            button('Revisar plantilla',()=>reviewTemplate(p),c);
        }
        notice(rows.length+' envío(s) pendiente(s).');
    }
    async function reviewTemplate(p) {
        clear();adminView('Revisión de plantillas','revision');
        const info=el('section',undefined,'seller-surface');area.append(info);templateInfo(p,info);info.append(el('p','Enviada: '+dateText(p.enviada_revision_at)));vendorName(p,info);await templateGallery(p,info);
        const controls=el('div',undefined,'seller-actions');info.append(controls);
        button('Descargar ZIP para revisión',async()=>{
            const blob=await api.zipRevision(p.id),url=URL.createObjectURL(blob);
            const a=link('Descargar',url);a.download='revision-'+shortRef(p.id)+'.zip';area.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notice('ZIP obtenido con tu permiso de administrador.');
        },controls);
        const approve=button('Aprobar y publicar',async()=>{if(!confirm('¿Aprobar y publicar esta plantilla?'))return;await api.revisar(p.id,'publicada');await admin();notice('Plantilla publicada.');},controls);approve.className='btn btn-primary';
        const rejectionBox=el('div',undefined,'seller-rejection');info.append(rejectionBox);
        const label=el('label','Motivo obligatorio para rechazar');label.htmlFor='review-reason';
        const reason=el('textarea');reason.id='review-reason';reason.required=true;reason.rows=3;reason.setAttribute('aria-label','Motivo del rechazo');rejectionBox.append(label,reason);
        button('Rechazar',async()=>{if(!reason.value.trim()){reason.reportValidity();throw Error('Indica el motivo del rechazo.');}await api.revisar(p.id,'rechazada',reason.value);await admin();notice('Plantilla rechazada. El vendedor puede corregirla.');},rejectionBox);
        button('Volver a revisión de plantillas',admin);notice('Revisa los datos, las imágenes, la demo y el archivo antes de decidir.');
    }
    function filtered(rows) {
        const value=id=>document.getElementById(id)?.value || '';
        const category=value('category-filter'), q=value('search-catalog').trim().toLocaleLowerCase('es');
        let result=rows.filter(p=>(!category || String(p.categoria_id)===category) && (!q || (p.nombre+' '+p.descripcion).toLocaleLowerCase('es').includes(q)));
        if(value('price-min')) result=result.filter(p=>Number(p.precio)>=Number(value('price-min')));
        if(value('price-max')) result=result.filter(p=>Number(p.precio)<=Number(value('price-max')));
        const sort=value('sort-filter');
        if(sort==='price-low') result.sort((a,b)=>a.precio-b.precio);
        if(sort==='price-high') result.sort((a,b)=>b.precio-a.precio);
        return result;
    }
    async function catalog() {
        const rows=filtered(await api.publicadas());
        if(rows.length) {
            clear(); area.className='templates-grid';
            for(const p of rows) {
                const c=el('article',undefined,'template-card public-template'), image=el('div',undefined,'template-image');
                const content=el('div',undefined,'template-content'), detail=link('Ver detalles','plantilla.html?id='+encodeURIComponent(p.id));
                detail.className+=' public-detail-link';
                content.append(el('h3',p.nombre,'template-title'),el('span',cats.find(x=>String(x.id)===String(p.categoria_id))?.nombre || 'Sin categoría','template-category'));
                if(mode==='catalogo' && typeof p.descripcion==='string' && p.descripcion.trim()) {
                    content.append(el('p',p.descripcion.trim(),'catalog-card-description'));
                }
                content.append(el('p',money(p.precio),'template-price'));
                if(mode==='catalogo') {
                    const actions=el('div',undefined,'catalog-card-actions');
                    const demo=safeURL(p.demo_url);
                    if(demo) {
                        const previewLink=link('Ver demo',demo);
                        previewLink.className='btn btn-outline btn-sm catalog-demo-link';
                        previewLink.target='_blank'; previewLink.rel='noopener noreferrer';
                        actions.append(previewLink);
                    }
                    actions.append(detail);
                    content.append(actions);
                } else content.append(detail);
                c.append(image,content);area.append(c);
                if(p.imagen_principal)photo(p.imagen_principal,image);else image.append(el('span','Sin imagen'));
            }
            notice(rows.length+' plantilla(s) publicada(s).');
        } else if(mode==='inicio') {
            notice('Explora el catálogo de plantillas web en TAVIKU.');
        } else {
            clear(); area.className='templates-grid';
            area.append(el('p','No hay plantillas publicadas que coincidan con tu búsqueda.'));
            notice('0 plantillas publicadas.');
        }
    }
    function viewTitle(text) {
        const heading=document.querySelector('#market-root h1');
        if(heading)heading.textContent=text;
    }
    const shortRef=id=>String(id || '').slice(0,8).toUpperCase();
    const dateText=value=>value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('es-PE',{timeZone:'America/Lima'}) : 'No registrada';
    const paymentLabel=o=>({pendiente:'Pendiente',verificado:'Verificado',rechazado:'Rechazado'}[o.estado_pago] || 'Estado no disponible');
    function badge(o) { return el('span',paymentLabel(o),'payment-badge payment-'+o.estado_pago); }
    function primary(b) { b.className='btn btn-primary';return b; }
    function actions(parent) { const box=el('div',undefined,'account-actions');parent.append(box);return box; }
    function toast(text) {
        let box=document.getElementById('account-toast');
        if(!box){box=el('div',undefined,'account-toast');box.id='account-toast';box.setAttribute('role','status');document.body.append(box);}
        clearTimeout(toast.timer);box.textContent=text;box.hidden=false;
        toast.timer=setTimeout(()=>{box.hidden=true;},2500);
    }
    function orderCard(o,parent=area) {
        const c=el('article',undefined,'account-card order-card'),image=el('div',undefined,'account-image'),content=el('div',undefined,'account-card-content');
        c.append(image,content);parent.append(c);
        content.append(el('h3',o.plantilla_nombre),el('p',money(o.monto),'account-price'),badge(o),el('p','Pedido '+shortRef(o.id),'account-muted'));
        if(o.created_at)content.append(el('p','Solicitud: '+dateText(o.created_at),'account-muted'));
        const revision=generation;
        api.detalle(o.plantilla_id).then(p=>{
            if(revision!==generation || !image.isConnected)return;
            if(p?.imagen_principal)photo(p.imagen_principal,image);else image.append(el('span','Imagen no disponible'));
        }).catch(()=>{if(revision===generation && image.isConnected)image.append(el('span','Imagen no disponible'));});
        return content;
    }
    async function buyerDetail(p) {
        const [favs,orders]=await Promise.all([api.favoritos(),pay.compras()]);clear();
        const gallery=el('div',undefined,'account-gallery'),info=el('section',undefined,'account-card account-detail');
        area.append(gallery,info);photo(p.imagen_principal,gallery);
        api.galeria(p.id).then(rows=>{if(gallery.isConnected)for(const image of rows)photo(image.url,gallery);}).catch(()=>{if(gallery.isConnected)gallery.append(el('p','No se pudo cargar la galería. Actualiza para reintentar.'));});
        info.append(el('h1',p.nombre),el('p',cats.find(c=>String(c.id)===String(p.categoria_id))?.nombre || 'Sin categoría'),el('p',money(p.precio),'account-price'));
        const tags=el('div',undefined,'account-actions');for(const tech of p.tecnologias || [])tags.append(el('span',tech,'payment-badge'));info.append(tags);
        const desc=el('p',p.descripcion,'account-description');info.append(desc);
        const demo=safeURL(p.demo_url);if(demo){const a=link('Ver demo',demo);a.target='_blank';a.rel='noopener noreferrer';info.append(a);}
        const buttons=actions(info),order=orders.find(o=>o.plantilla_id===p.id && o.estado_pago==='verificado') || orders.find(o=>o.plantilla_id===p.id && o.estado_pago==='pendiente') || orders.find(o=>o.plantilla_id===p.id && o.estado_pago==='rechazado');
        if(order)buttons.append(primary(link(order.estado_pago==='verificado'?'Ver compra':order.estado_pago==='rechazado'?'Corregir comprobante':'Ver estado del pago','compra.html?pedido='+encodeURIComponent(order.id))));
        else primary(button('Comprar con Yape',async()=>{const order=await pay.crear(p.id);location.href='compra.html?pedido='+encodeURIComponent(order.id);},buttons));
        if(p.vendedor_id)buttons.append(link('Ver vendedor','vendedor.html?id='+encodeURIComponent(p.vendedor_id)));
        let saved=favs.some(f=>f.plantilla_id===p.id);
        const favorite=button(saved?'Quitar de favoritos':'Guardar en favoritos',async()=>{
            await api.favorito(p.id,!saved);saved=!saved;favorite.textContent=saved?'Quitar de favoritos':'Guardar en favoritos';favorite.setAttribute('aria-pressed',String(saved));notice('');toast(saved?'Guardada en favoritos':'Eliminada de favoritos');
        },buttons);favorite.setAttribute('aria-pressed',String(saved));
        info.append(el('p','Licencia estándar: 1 sitio final · modificable · no redistribuible.','account-muted'),link('Ver licencia completa','licencias.html'));notice('');
    }
    async function detail() {
        const p=await api.detalle(new URLSearchParams(location.search).get('id')); clear();
        if(!p) { notice('Plantilla no disponible o aún no publicada.'); area.append(link('Volver al catálogo','catalogo.html')); return; }
        const session=await verificarSesion();
        if(session.success && session.rol==='comprador')return buyerDetail(p);
        area.append(el('h1',p.nombre),el('p',money(p.precio))); description(p,area); await preview(p,area);
        const requireSession=async reason=>{
            const session=await verificarSesion();
            if(session.session)return true;
            if(session.code==='NO_SESSION')location.href='login.html?motivo='+reason+'&plantilla='+encodeURIComponent(p.id);
            else notice(session.error || 'No se pudo comprobar tu sesión. Reintenta.');
            return false;
        };
        button('Guardar en favoritos',async()=>{ if(!await requireSession('favoritos'))return;await api.favorito(p.id,true); notice('Guardada en tus favoritos.'); });
        if(p.vendedor_id)area.append(link('Ver vendedor','vendedor.html?id='+encodeURIComponent(p.vendedor_id)));
        button('Comprar con Yape',async()=>{if(!await requireSession('comprar'))return;const order=await pay.crear(p.id);location.href='compra.html?pedido='+encodeURIComponent(order.id);});
        const panel=button('Ver mi panel',()=>redirigirSegunRol());
        panel.setAttribute('data-detail-panel','');
        panel.hidden=document.documentElement.getAttribute('data-session-state')!=='authenticated';
        notice('Plantilla publicada.');
    }
    async function buyer() {
        const favs=await api.favoritos(), orders=await pay.compras(); clear();
        viewTitle('Mi panel');
        const shortcuts=actions(area);button('Historial de movimientos',historial,shortcuts);button('Mi perfil',perfil,shortcuts);
        area.append(el('h2','Mis compras y pedidos'));
        const grid=el('div',undefined,'account-grid');area.append(grid);
        if(!orders.length){grid.append(el('p','Todavía no tienes compras ni pedidos. Explora las plantillas para comenzar.','account-empty'),link('Explorar plantillas','catalogo.html'));}
        for(const o of orders) {
            const c=orderCard(o,grid);if(o.motivo_rechazo)c.append(el('p','Motivo: '+o.motivo_rechazo));
            primary(button(o.estado_pago==='verificado'?'Ver compra / Descargar ZIP':o.estado_pago==='rechazado'?'Corregir comprobante':'Ver estado del pago',()=>checkout(o.id),actions(c)));
        }
        const signature=rows=>JSON.stringify(rows.map(o=>[o.id,o.estado_pago,o.enviada_pago_at,o.motivo_rechazo]));let previous=signature(orders);
        refreshOrders=async current=>{
            const rows=await pay.compras();if(!current())return;
            if(signature(rows)!==previous){previous=signature(rows);await buyer();}
        };
        area.append(el('h2','Mis favoritos'));
        const favorites=el('div',undefined,'account-grid');area.append(favorites);
        if(!favs.length) favorites.append(el('p','Todavía no guardaste favoritos. Guarda las plantillas que te interesan desde su detalle.','account-empty'));
        for(const f of favs) {
            const p=await api.detalle(f.plantilla_id),c=el('article',undefined,'account-card');favorites.append(c);
            if(!p)c.append(el('p','Plantilla ya no disponible'));
            else {const image=el('div',undefined,'account-image');c.append(image);photo(p.imagen_principal,image);c.append(el('h3',p.nombre),el('p',cats.find(x=>String(x.id)===String(p.categoria_id))?.nombre || 'Sin categoría'),el('p',money(p.precio),'account-price'));}
            const buttons=actions(c);if(p)buttons.append(link('Ver plantilla','plantilla.html?id='+p.id));
            button('Quitar de favoritos',async()=>{await api.favorito(f.plantilla_id,false); await buyer();toast('Eliminada de favoritos');},buttons);
        }
        notice('Información de tu cuenta actualizada.');
    }
    async function saveBlob(blob,name) {
        const url=URL.createObjectURL(blob),a=link('Descargar',url); a.download=name;area.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
    async function checkout(id) {
        const o=await pay.pedido(id);clear();
        const title=p=>viewTitle(p.estado_pago==='pendiente'?(p.enviada_pago_at?'Pago en revisión':'Completa tu compra'):'Detalle de compra');title(o);
        const content=orderCard(o),label=content.querySelector('.payment-badge'),payment=el('div',undefined,'account-payment');
        content.append(payment);
        if(o.estado_pago==='pendiente' && o.enviada_pago_at)label.textContent='Pendiente de verificación';
        renderPayment(o,payment);
        const signature=p=>JSON.stringify([p.estado_pago,p.enviada_pago_at,p.motivo_rechazo,p.revisado_por,p.revisado_at,p.operacion_yape]);
        let previous=signature(o);
        refreshOrders=async current=>{
            const next=await pay.pedido(id);if(!current() || signature(next)===previous)return;
            previous=signature(next);title(next);label.textContent=next.estado_pago==='pendiente' && next.enviada_pago_at?'Pendiente de verificación':paymentLabel(next);label.className='payment-badge payment-'+next.estado_pago;
            payment.replaceChildren();renderPayment(next,payment);
            notice(next.estado_pago==='verificado'?'Pago aprobado. Tu descarga está disponible.':'Estado del pedido actualizado.');
        };
        const back=actions(area);
        if(mode==='compra')back.append(link('Volver a Mis compras','panel-comprador.html'));
        else button('Volver a Mis compras',buyer,back);
        notice('Pedido actualizado.');
    }
    function renderPayment(o,parent) {
        if(o.estado_pago==='verificado') {
            const fecha=o.revisado_at ? new Date(o.revisado_at) : null;
            parent.append(el('p','Fecha de verificación: '+(fecha && Number.isFinite(fecha.getTime())
                ? new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'}).format(fecha)
                : 'No registrada')));
            parent.append(el('p','Operación Yape: '+(o.operacion_yape || 'No registrada')));
            primary(button('Descargar ZIP',async()=>{await saveBlob(await pay.descargar(o.id),'plantilla-'+o.plantilla_id+'.zip');notice('Descarga autorizada por tu compra verificada.');},parent));
        } else if(o.estado_pago==='pendiente' && o.enviada_pago_at) {
            parent.append(el('p','Comprobante recibido. Un administrador verificará el abono. No vuelvas a pagar.'));
        } else {
            if(o.motivo_rechazo) parent.append(el('p','Motivo del rechazo: '+o.motivo_rechazo));
            const destination=el('div',undefined,'account-yape');destination.append(el('h3','Pago por Yape'),el('p','Número: '+o.yape_numero),el('p','Titular: '+o.yape_titular),el('p','Monto exacto: '+money(o.monto),'account-price'));parent.append(destination);
            const steps=el('ol',undefined,'account-steps');for(const step of ['Paga exactamente el monto indicado.','Verifica número y titular.','Toma captura del comprobante.','Súbelo.','Espera verificación.'])steps.append(el('li',step));parent.append(steps,el('p','Si ya realizaste el pago, no vuelvas a pagar.','account-warning'));
            const form=el('form'),file=field(form,'Comprobante JPG, PNG o WebP (máximo 5 MB)','comprobante',null,'file');file.accept='.jpg,.jpeg,.png,.webp';file.required=true;
            const send=el('button','Enviar comprobante','btn btn-primary');send.type='submit';form.append(send);parent.append(form);
            form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const selected=file.files[0];
                action(async()=>{await pay.subir(o.id,selected,notice);await checkout(o.id);notice('Comprobante recibido: pendiente de verificación.');});});
            button('Recuperar último comprobante',async()=>{await pay.recuperar(o.id);await checkout(o.id);},parent);
        }
    }
    async function historial() {
        if(mode==='comprador' || mode==='compra')return buyerHistory();
        const rows=await pay.historial();clear();area.append(el('h2','Historial'));
        for(const r of rows)area.append(el('p',new Date(r.created_at).toLocaleString('es-PE')+' — '+r.entidad+' — '+r.accion+' — '+(r.detalle||'')));
        if(!rows.length)area.append(el('p','Sin movimientos.'));button('Volver',reload);notice('Historial registrado en el servidor.');
    }
    async function buyerHistory() {
        const [rows,orders]=await Promise.all([pay.historial(),pay.compras()]);clear();viewTitle('Historial de movimientos');
        const labels={creado:'Pedido creado',comprobante_enviado:'Comprobante enviado',pago_verificado:'Pago verificado',pago_rechazado:'Pago rechazado'};
        const list=el('div',undefined,'account-history');area.append(list);
        for(const r of [...rows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))) {
            const o=r.entidad==='pedido'?orders.find(o=>o.id===r.entidad_id):null,c=el('article',undefined,'account-card');
            c.append(el('p',dateText(r.created_at),'account-muted'),el('h3',labels[r.accion] || 'Movimiento registrado'),el('p',o?o.plantilla_nombre+' · Pedido '+shortRef(o.id):'Pedido '+shortRef(r.entidad_id)));
            if(o)c.append(el('p','Monto: '+money(o.monto)));
            if(r.accion==='pago_verificado' && o?.operacion_yape)c.append(el('p','Operación Yape: '+o.operacion_yape));
            list.append(c);
        }
        if(!rows.length)list.append(el('p','Todavía no hay movimientos en tu cuenta.','account-empty'));
        button('Volver a Mi panel',buyer,actions(area));notice('');
    }
    async function configurarYape() {
        const c=await pay.config();clear();adminView('Configurar Yape','yape');area.append(el('h2','Destino de los pagos por Yape'));adminInfo('Los pedidos existentes conservan su destino original.');
        const form=el('form',undefined,'seller-surface seller-editor'),numero=field(form,'Número Yape de la plataforma','numero',c.yape_numero||''),titular=field(form,'Titular que verá el comprador','titular',c.yape_titular||'');
        numero.pattern='9[0-9]{8}';numero.inputMode='numeric';numero.maxLength=9;numero.minLength=9;numero.required=true;numero.title='9 dígitos, empezando por 9';titular.pattern='[\\p{L} ]+';titular.minLength=3;titular.required=true;
        const b=el('button','Guardar destino Yape','btn btn-primary');b.type='submit';form.append(b);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const n=numero.value,t=titular.value.normalize('NFC').trim();
            if(!/^9[0-9]{8}$/.test(n)||t.length<3||! /^[\p{L} ]+$/u.test(t)){notice('Ingresa un Yape de 9 dígitos empezando por 9 y un titular de al menos 3 caracteres, solo letras y espacios.');return;}
            action(async()=>{if(!confirm('¿Guardar el nuevo destino Yape? Número: '+n+'. Titular: '+t+'. Los pedidos existentes conservan su destino original.'))return;await pay.configurar(n,t);await configurarYape();notice('Destino Yape configurado.');});});
        button('Volver',admin);notice(c.activo?'':'Compras bloqueadas hasta configurar el destino real.');
    }

    async function pagosAdmin() {
        const rows=await pay.pedidosAdmin();clear();adminView('Pagos y ventas','pagos');
        const names=await adminNames();
        const fechaPeru=()=>new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
        const prefijos=[],revision=generation;
        const actualizarFechas=()=>prefijos.forEach(p=>{p.textContent=fechaPeru()+' - Operación ';});
        const reloj=setInterval(()=>{if(revision!==generation)clearInterval(reloj);else actualizarFechas();},1000);
        const approved=rows.filter(o=>o.estado_pago==='verificado');
        area.append(el('p','Ventas verificadas: '+money(approved.reduce((n,o)=>n+Number(o.monto),0))+' · Plataforma: '+money(approved.reduce((n,o)=>n+Number(o.comision_plataforma),0))));
        if(!rows.length)area.append(el('p','No hay pedidos.'));
        const groups={};for(const [key,title] of [['pendiente','Pendientes'],['verificado','Verificados'],['rechazado','Rechazados']]) {
            const section=el('section',undefined,'account-payment-group');section.append(el('h2',title));const grid=el('div',undefined,'account-grid');section.append(grid);area.append(section);groups[key]=grid;
            if(!rows.some(o=>o.estado_pago===key))grid.append(el('p','No hay pedidos '+title.toLowerCase()+'.','account-empty'));
        }
        for(const o of rows) {
            const c=orderCard(o,groups[o.estado_pago] || area);c.append(el('p','Comprador: '+(names.get(o.comprador_id)||shortRef(o.comprador_id))),el('p','Vendedor: '+(names.get(o.vendedor_id)||shortRef(o.vendedor_id))));c.append(el('p','20% plataforma: '+money(o.comision_plataforma)+' · 80% vendedor: '+money(o.ingreso_vendedor)));
            if(o.motivo_rechazo)c.append(el('p','Motivo: '+o.motivo_rechazo));
            if(o.estado_pago==='verificado')c.append(el('p','Fecha de verificación: '+dateText(o.revisado_at)),el('p','Operación Yape: '+(o.operacion_yape || 'No registrada')));
            if(o.comprobante_url) button('Ver comprobante',async()=>{
                const blob=await pay.evidencia(o.comprobante_url),url=URL.createObjectURL(blob);urls.push(url);const img=el('img');img.src=url;img.alt='Comprobante presentado';img.style.maxWidth='100%';c.append(img);notice('Compara la imagen con el abono real en Yape. La captura por sí sola no confirma el pago.');
            },c);
            if(o.estado_pago==='pendiente' && o.enviada_pago_at) {
                c.append(el('p','Destino: '+o.yape_numero+' / '+o.yape_titular));
                const prefijo=el('p',fechaPeru()+' - Operación ');prefijos.push(prefijo);c.append(prefijo);
                const ref=field(c,'Código/número de operación Yape','ref-'+o.id,'');
                primary(button('Confirmar abono y habilitar descarga',async()=>{
                    const codigo=ref.value.trim();
                    if(!codigo)throw new Error('Escribe el código/número de operación Yape.');
                    if(!confirm('¿Comprobaste el ingreso real de '+money(o.monto)+' al Yape indicado? Esta aprobación habilita el ZIP y acredita el 80% al vendedor.'))return;
                    await pay.revisar(o.id,true,fechaPeru()+' - Operación '+codigo);paymentChannel?.postMessage('actualizar');await pagosAdmin();notice('Pago aprobado y descarga habilitada.');
                },c));
                const motivo=field(c,'Motivo para rechazar el comprobante','motivo-'+o.id,'');
                motivo.required=true;
                button('Rechazar comprobante',async()=>{if(!motivo.value.trim()){motivo.reportValidity();throw new Error('Escribe el motivo del rechazo.');}await pay.revisar(o.id,false,motivo.value);paymentChannel?.postMessage('actualizar');await pagosAdmin();notice('Comprobante rechazado; el comprador puede corregirlo.');},c);
            }
        }
        notice('Pedidos consultados. Solo un abono real debe aprobarse.');
    }
    async function finanzas() {
        const orders=await pay.ventas(),withdrawals=await pay.retiros(),b=pay.balance(orders,withdrawals);clear();
        sellerView('Ventas, ganancias y retiros','ventas');
        const summary=el('div',undefined,'seller-summary');area.append(summary);
        for(const [label,value] of [['Ganado',b.total],['Reservado',b.reservado],['Pagado',b.pagado],['Disponible',b.disponible]]){const box=el('div',undefined,'seller-surface');box.append(el('span',label),el('strong',money(value)));summary.append(box);}
        area.append(el('h2','Ventas verificadas'));
        const sales=el('div',undefined,'seller-grid');area.append(sales);
        for(const o of orders.filter(o=>o.estado_pago==='verificado')){const row=el('article',undefined,'seller-surface');row.append(el('h3',o.plantilla_nombre),el('p','Venta total: '+money(o.monto)),el('p','80% vendedor: '+money(o.ingreso_vendedor)),el('span','Verificado','seller-badge seller-publicada'));if(o.revisado_at || o.created_at)row.append(el('p',dateText(o.revisado_at || o.created_at)));sales.append(row);}
        if(!sales.children.length)sales.append(el('p','Aún no tienes ventas verificadas.','seller-empty'));
        area.append(el('h3','Solicitar retiro por Yape (mínimo S/50)'));
        const pendiente=withdrawals.some(r=>['pendiente','aprobado'].includes(r.estado));
        const bloqueado=pendiente || !Number.isFinite(b.disponible) || b.disponible<50;
        area.append(el('p','Disponible para retirar: '+money(b.disponible)));
        if(b.disponible<50)area.append(el('p','Te faltan '+money((5000-Math.round(b.disponible*100))/100)+' para llegar al mínimo de S/50.'));
        if(pendiente)area.append(el('p','Tienes un retiro pendiente de resolución. Espera a que sea pagado o rechazado.'));
        const form=el('form'),group=el('fieldset');group.disabled=bloqueado;group.style.border='0';group.style.padding='0';group.style.margin='0';form.append(group);
        const amount=field(group,'Monto total a retirar (S/)','retiro-monto',b.disponible.toFixed(2),'number'),number=field(group,'Tu número Yape','retiro-numero',''),name=field(group,'Titular','retiro-titular','');
        amount.readOnly=true;amount.step='0.01';number.pattern='[0-9]{9}';number.inputMode='numeric';number.maxLength=9;number.minLength=9;number.required=true;
        name.pattern='[\\p{L} ]+';name.minLength=2;name.required=true;
        const send=el('button','Solicitar retiro','btn btn-primary');send.type='submit';send.disabled=bloqueado;group.append(send);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(bloqueado || busy || !form.reportValidity())return;const n=number.value,t=name.value.normalize('NFC').trim();
            if(!/^[0-9]{9}$/.test(n) || t.length<2 || !/^[\p{L} ]+$/u.test(t)){notice('Ingresa un Yape de 9 dígitos y un titular de al menos 2 caracteres, solo letras y espacios.');return;}
            if(!confirm('Confirma tu retiro:\nMonto: '+money(b.disponible)+'\nYape: '+n+'\nTitular: '+t))return;
            action(async()=>{await pay.solicitar(b.disponible,n,t);await finanzas();notice('Solicitud registrada. El saldo queda reservado hasta su resolución.');});});
        button('Historial de retiros',sellerWithdrawals);button('Mis plantillas',seller);notice('El saldo se calcula con ventas verificadas y retiros reservados o pagados.');
    }
    async function sellerWithdrawals() {
        const withdrawals=await pay.retiros();clear();sellerView('Historial de retiros','ventas');
        area.append(el('p','Aquí puedes consultar tus solicitudes de retiro y su estado.'));
        if(!withdrawals.length)area.append(el('p','Aún no tienes retiros registrados.','seller-empty'));
        const list=el('div',undefined,'seller-grid');area.append(list);
        for(const r of withdrawals){
            const c=el('article',undefined,'seller-surface');list.append(c);
            c.append(el('h2',money(r.monto)),el('span',({pendiente:'Pendiente',aprobado:'Pendiente',pagado:'Pagado',rechazado:'Rechazado'}[r.estado]||r.estado),'seller-badge '+(r.estado==='pagado'?'seller-publicada':r.estado==='rechazado'?'seller-rechazada':'seller-pendiente')),el('p','Fecha de solicitud: '+dateText(r.created_at)),el('p','Yape: '+r.destino_numero),el('p','Titular: '+r.destino_titular));
            if(r.pagado_at)c.append(el('p','Fecha de pago: '+dateText(r.pagado_at)));
            if(r.referencia_pago)c.append(el('p','Operación Yape: '+r.referencia_pago));
            if(r.motivo_rechazo)rejection(r,c);
        }
        button('Volver a Ventas y retiros',finanzas);notice('');
    }
    async function retirosAdmin() {
        const rows=await pay.retiros(true),names=await adminNames();clear();adminView('Solicitudes de retiro','retiros');
        area.append(el('p','Revisa y procesa las solicitudes de retiro de los vendedores.'));adminInfo('Las transferencias se realizan personalmente fuera de la plataforma.');
        if(!rows.length)area.append(el('p','Sin solicitudes.','seller-empty'));
        const list=el('div',undefined,'seller-grid');area.append(list);
        for(const r of rows) {
            const c=el('article',undefined,'seller-surface admin-withdrawal');list.append(c);
            c.append(el('h2',money(r.monto),'seller-price'),el('span',({pendiente:'Pendiente',aprobado:'Pendiente',pagado:'Pagado',rechazado:'Rechazado'}[r.estado]||r.estado),'seller-badge '+(r.estado==='pagado'?'seller-publicada':r.estado==='rechazado'?'seller-rechazada':'seller-pendiente')),
                el('h3',names.get(r.vendedor_id)||'Vendedor '+shortRef(r.vendedor_id)),el('p','Yape: '+r.destino_numero),el('p','Titular: '+r.destino_titular),el('p','Fecha de solicitud: '+dateText(r.created_at)),el('p','Referencia: '+shortRef(r.id),'seller-help'));
            if(r.referencia_pago)c.append(el('p','Operación Yape: '+r.referencia_pago));if(r.pagado_at)c.append(el('p','Fecha de pago: '+dateText(r.pagado_at)));rejection(r,c);
            if(['pendiente','aprobado'].includes(r.estado)) {
                const operation=field(c,'Código de operación Yape','retiro-operacion-'+r.id,'');operation.required=true;operation.minLength=3;
                const paid=button('Registrar como pagado',async()=>{
                    const code=operation.value.trim();if(code.length<3)throw Error('Indica el código de operación Yape (mínimo 3 caracteres).');
                    if(!confirm('¿Ya transferiste '+money(r.monto)+' al Yape indicado? Esta acción registrará el retiro como pagado; no realiza una transferencia.'))return;
                    await pay.revisarRetiro(r.id,'pagado',code);await retirosAdmin();notice('Retiro pagado. Código y fecha registrados.');
                },c);paid.className='btn btn-primary';
                const reason=field(c,'Motivo del rechazo','retiro-motivo-'+r.id,'','textarea');reason.required=true;reason.minLength=3;
                button('Rechazar y liberar saldo',async()=>{
                    const cause=reason.value.trim();if(cause.length<3)throw Error('Indica el motivo del rechazo (mínimo 3 caracteres).');
                    if(!confirm('¿Rechazar este retiro y devolver '+money(r.monto)+' al saldo disponible del vendedor?'))return;
                    await pay.revisarRetiro(r.id,'rechazado',cause);await retirosAdmin();notice('Retiro rechazado. Saldo liberado.');
                },c);
            }
        }
        notice('');
    }

    async function usuarios() {
        const rows=await api.usuarios(),session=await verificarSesion();clear();adminView('Usuarios','usuarios');adminInfo('No se muestran contraseñas ni credenciales.');
        const search=field(area,'Buscar por nombre, correo, ID o rol','usuario-busqueda',''),list=el('div',undefined,'admin-users');area.append(list);
        const render=()=>{list.replaceChildren();for(const p of rows.filter(p=>([p.nombre_completo,p.email,p.correo,p.id,p.rol].filter(Boolean).join(' ')).toLowerCase().includes(search.value.toLowerCase()))) {
            const c=el('article',undefined,'seller-surface admin-user');list.append(c);c.append(el('h3',p.nombre_completo || 'Sin nombre'),el('p',p.email||p.correo||'Correo no disponible'),el('span',p.rol,'seller-badge'),el('p','ID: '+shortRef(p.id),'seller-help'));
            if(p.id===session.user?.id){c.append(el('p','Tu cuenta · rol protegido','seller-help'));continue;}
            const select=el('select');select.setAttribute('aria-label','Rol de '+(p.nombre_completo||shortRef(p.id)));
            for(const role of ['comprador','vendedor','admin'])select.add(new Option(role,role));select.value=p.rol;c.append(select);
            button('Guardar rol',async()=>{if(select.value===p.rol)return;if(p.rol==='admin'&&select.value!=='admin'&&rows.filter(x=>x.rol==='admin').length<=1)throw Error('Debe permanecer al menos un administrador.');if(!confirm('¿Cambiar el rol de '+(p.nombre_completo||shortRef(p.id))+' a '+select.value+'? Cambiarán sus permisos de acceso.'))return;
                await api.cambiarRol(p.id,select.value);await usuarios();notice('Rol actualizado mediante la función administrativa protegida.');},c);
        }};search.addEventListener('input',render);render();button('Volver',admin);notice(rows.length+' perfiles registrados.');
    }

    async function perfil() {
        if(mode==='comprador' || mode==='compra')return buyerProfile();
        if(mode==='vendedor')return sellerProfile();
        const [p,session]=await Promise.all([api.miPerfil(),verificarSesion()]);clear();adminView('Mi perfil','perfil');
        const form=el('form',undefined,'seller-surface seller-editor');form.append(el('span','Admin','seller-badge'));
        const name=field(form,'Nombre','perfil-nombre',p.nombre_completo),email=field(form,'Correo','perfil-correo',session.user?.email||'','email'),bio=field(form,'Biografía','perfil-bio',p.bio,'textarea');name.required=true;name.maxLength=120;bio.maxLength=2000;email.readOnly=true;
        const b=el('button','Guardar cambios','btn btn-primary');b.type='submit';form.append(b);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;action(async()=>{await api.miPerfil({nombre_completo:name.value,bio:bio.value});notice('Perfil guardado.');});});
        button('Volver al panel admin',admin);notice('Puedes actualizar tu nombre y biografía.');
    }

    async function sellerProfile() {
        const [p,session]=await Promise.all([api.miPerfil(),verificarSesion()]);clear();sellerView('Mi perfil','perfil');
        const form=el('form',undefined,'seller-surface seller-editor');form.append(el('span','Vendedor','seller-badge'));
        const name=field(form,'Nombre','perfil-nombre',p.nombre_completo),email=field(form,'Correo','perfil-correo',session.user?.email || '','email'),bio=field(form,'Biografía','perfil-bio',p.bio,'textarea');name.required=true;name.maxLength=120;bio.maxLength=2000;email.readOnly=true;
        const save=el('button','Guardar cambios','btn btn-primary');save.type='submit';form.append(save);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;action(async()=>{await api.miPerfil({nombre_completo:name.value,bio:bio.value});notice('Perfil guardado.');});});
        button('Volver a Mi panel',seller);notice('Tu biografía se muestra en tu perfil público.');
    }
    async function buyerProfile() {
        const [p,session]=await Promise.all([api.miPerfil(),verificarSesion()]);clear();viewTitle('Mi perfil');
        const form=el('form',undefined,'account-card account-profile');form.append(el('span','Comprador','payment-badge'));
        const name=field(form,'Nombre','perfil-nombre',p.nombre_completo),email=field(form,'Correo','perfil-correo',session.user?.email || '', 'email'),bio=field(form,'Biografía (opcional)','perfil-bio',p.bio,'textarea');
        name.required=true;name.maxLength=120;email.readOnly=true;bio.maxLength=2000;
        const buttons=actions(form),save=el('button','Guardar cambios','btn btn-primary');save.type='submit';buttons.append(save);button('Volver a Mi panel',buyer,buttons);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const datos={nombre_completo:name.value,bio:bio.value};action(async()=>{await api.miPerfil(datos);notice('Perfil guardado.');});});notice('Puedes actualizar tu nombre y biografía.');
    }
    async function vendedorPublico() {
        const id=new URLSearchParams(location.search).get('id');if(!id){clear();notice('Selecciona un vendedor desde una plantilla publicada.');area.append(link('Ver catálogo','catalogo.html'));return;}
        const p=await api.perfilPublico(id);clear();if(!p){notice('Vendedor no disponible.');return;}
        area.append(el('h1',p.nombre_completo),el('p',p.bio || ''),el('h2','Plantillas publicadas'));
        const rows=(await api.publicadas()).filter(x=>x.vendedor_id===p.id);
        for(const t of rows){const c=card(t);c.append(link('Ver plantilla','plantilla.html?id='+t.id));photo(t.imagen_principal,c);}
        notice(rows.length+' plantilla(s) publicada(s).');
    }
    const reload=()=>({vendedor:seller,admin,comprador:buyer,detalle:detail,catalogo:catalog,inicio:catalog,
        compra:()=>checkout(new URLSearchParams(location.search).get('pedido')), 'vendedor-publico':vendedorPublico}[mode])();
    let account;
    if (typeof supabaseClient !== 'undefined' && supabaseClient) supabaseClient.auth.onAuthStateChange((event,session)=> {
        const next=session?.user?.id || null;
        if(account !== undefined && next !== account) {
            if(area) clear();
            // A same-role account switch must not leave the previous account's private rows visible.
            if(status) notice('La sesión cambió. Recargando…');
            setTimeout(()=>location.reload(),0);
        }
        account=next;
    });
    document.addEventListener('DOMContentLoaded',async()=> {
        area=document.getElementById('market-content'); status=document.getElementById('market-status'); if(!area) return;
        if(['comprador','compra','admin'].includes(mode)) {
            const markPanel=()=>{
                const panel=document.getElementById('user-panel-btn');
                if(panel && mode!=='compra')panel.setAttribute('aria-current','page');
            };
            const auth=document.querySelector('.auth-buttons');
            if(auth){new MutationObserver(markPanel).observe(auth,{childList:true});markPanel();}
        }
        document.getElementById('market-reload').addEventListener('click',()=>{if(!busy) location.reload();});
        try {
            if(['vendedor','admin','comprador','compra'].includes(mode) && !await window.accesoPagina) return;
            if(mode==='admin')reviewNav(new URLSearchParams(location.search).get('vista')||'revision');
            cats=await api.categorias();
            const select=document.getElementById('category-filter');
            if(select) {
                select.replaceChildren(new Option('Todas las categorías','')); cats.forEach(c=>select.add(new Option(c.nombre,String(c.id))));
                const params=new URLSearchParams(location.search); const cat=params.get('category');
                const categoryKey=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'-');
                select.value=cats.find(c=>String(c.id)===cat || categoryKey(c.nombre)===categoryKey(cat))?.id || '';
                document.getElementById('search-catalog').value=params.get('search') || '';
                document.getElementById('apply-filters').addEventListener('click',()=>action(catalog));
                document.getElementById('clear-filters')?.addEventListener('click',()=>{
                    if(busy)return;
                    for(const id of ['category-filter','search-catalog','price-min','price-max'])document.getElementById(id).value='';
                    document.getElementById('sort-filter').value='featured';
                    history.replaceState(null,'',location.pathname);action(catalog);
                });
                document.getElementById('search-catalog').addEventListener('keydown',e=>{if(e.key==='Enter') {e.preventDefault(); action(catalog);}});
            }
            if(mode==='vendedor'){const view=new URLSearchParams(location.search).get('vista');await (view==='ventas'?finanzas:view==='perfil'?sellerProfile:seller)();}else if(mode==='admin'){const view=new URLSearchParams(location.search).get('vista');await ({pagos:pagosAdmin,retiros:retirosAdmin,yape:configurarYape,usuarios,perfil}[view]||admin)();}else await reload();
        } catch(e) { notice(e.message || 'No se pudo cargar. Pulsa Actualizar para reintentar.'); }
    });
    window.addEventListener('pagehide',()=>urls.forEach(u=>URL.revokeObjectURL(u)));
})();
