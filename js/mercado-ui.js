/* DOM seguro: los textos de vendedores se muestran como texto, nunca como HTML. */
(function() {
    'use strict';
    const api = window.TemboraMercado;
    const pay = window.TemboraPagos;
    let area, status, busy = false, cats = [], urls = [], generation = 0;
    const mode = document.body.dataset.market;
    const el = (tag,text,cls) => { const e=document.createElement(tag); if(text !== undefined) e.textContent=text; if(cls) e.className=cls; return e; };
    const money = n => new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(Number(n));
    const state = p => p.estado === 'pendiente' && !p.enviada_revision_at ? 'En preparación' : ({pendiente:'Pendiente de aprobación',publicada:'Publicada',rechazada:'Rechazada'}[p.estado] || p.estado);
    function notice(text) { status.textContent=text; }
    function link(text,href) { const a=el('a',text,'btn btn-outline btn-sm'); a.href=href; return a; }
    function safeURL(value) { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch (_) { return null; } }
    function clear() { generation++; urls.forEach(u=>URL.revokeObjectURL(u)); urls=[]; area.replaceChildren(); }
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
    async function seller() {
        const rows=await api.propias(); clear();
        area.append(link('Agregar plantilla','vender.html'));
        button('Ventas, ganancias y retiros',finanzas);
        button('Mi perfil',perfil);
        if(!rows.length) area.append(el('p','Todavía no tienes plantillas.'));
        for(const p of rows) {
            const c=card(p); c.append(el('p',state(p)),el('p','Referencia: '+p.id));
            if(p.motivo_rechazo) c.append(el('p','Motivo de rechazo: '+p.motivo_rechazo));
            button('Ver información',async()=> { clear(); area.append(el('h2',p.nombre)); description(p,area); await preview(p,area); button('Volver',seller); notice(state(p)); },c);
            if(api.editable(p)) {
                button('Editar / corregir',()=>editor(p),c);
                button('Limpiar archivos antiguos sin uso',async()=>{await api.limpiarObsoletos(p.id);notice('Limpieza comprobada. Se conservaron los archivos referenciados y los subidos en las últimas 24 horas.');},c);
                button('Enviar a revisión',async()=> { if(!confirm('¿Enviar esta versión a revisión? Quedará bloqueada.')) return; await api.enviar(p.id); await seller(); notice('Enviada: pendiente de aprobación.'); },c);
                button('Retirar plantilla',async()=> {
                    if(!confirm('¿Eliminar esta preparación o plantilla rechazada y sus archivos? Esta acción no se puede deshacer.')) return;
                    await api.retirar(p.id);
                    // Clear only the receipt for the successfully removed preparation.
                    try { const key='tembora:envio:'+p.vendedor_id; if(JSON.parse(localStorage.getItem(key) || 'null')?.id===p.id) localStorage.removeItem(key); } catch(_) { /* The panel remains usable without local storage. */ }
                    await seller(); notice('Plantilla retirada.');
                },c);
            }
        }
        notice(rows.length+' plantilla(s). Las enviadas y publicadas están bloqueadas.');
    }
    function field(form,label,name,value,type='text') {
        const box=el('div',undefined,'form-group'), l=el('label',label);
        const input=el(type==='textarea'?'textarea':'input'); input.id='edit-'+name; input.name=name;
        l.htmlFor=input.id; if(type!=='textarea') input.type=type;
        if(type!=='file') input.value=value ?? ''; box.append(l,input); form.append(box); return input;
    }
    async function editor(p) {
        clear(); area.append(el('h2','Corregir '+p.nombre));
        if(p.motivo_rechazo) area.append(el('p','Motivo: '+p.motivo_rechazo));
        const form=el('form'), inputs={};
        inputs.nombre=field(form,'Título','nombre',p.nombre); inputs.nombre.required=true;
        inputs.descripcion=field(form,'Descripción (mínimo 100 caracteres)','descripcion',p.descripcion,'textarea'); inputs.descripcion.minLength=100; inputs.descripcion.required=true;
        inputs.precio=field(form,'Precio (S/)','precio',p.precio,'number'); inputs.precio.min=20; inputs.precio.step='0.01'; inputs.precio.required=true;
        const label=el('label','Categoría'); label.htmlFor='edit-categoria'; inputs.categoria_id=el('select'); inputs.categoria_id.id='edit-categoria';
        for(const c of cats) inputs.categoria_id.add(new Option(c.nombre,String(c.id)));
        inputs.categoria_id.value=String(p.categoria_id); form.append(label,inputs.categoria_id);
        inputs.tecnologias=field(form,'Tecnologías separadas por comas','tecnologias',(p.tecnologias || []).join(', ')); inputs.tecnologias.required=true;
        inputs.demo_url=field(form,'Demo (opcional)','demo_url',p.demo_url,'url');
        form.append(el('p','Para conservar los archivos, deja los siguientes campos vacíos. Para reemplazarlos, selecciona nuevamente la imagen principal y el ZIP, más las imágenes adicionales que quieras conservar.'));
        const principal=field(form,'Imagen principal (máximo 5 MB)','principal',null,'file'); principal.accept='.jpg,.jpeg,.png,.webp';
        const gallery=field(form,'Hasta 5 imágenes adicionales (5 MB cada una)','galeria',null,'file'); gallery.multiple=true; gallery.accept=principal.accept;
        const zip=field(form,'ZIP privado (máximo 50 MB)','zip',null,'file'); zip.accept='.zip';
        const save=el('button','Guardar corrección','btn btn-primary'); save.type='submit'; form.append(save); area.append(form);
        form.addEventListener('submit',e=> {
            e.preventDefault(); if(!form.reportValidity()) return;
            const datos=Object.fromEntries(Object.entries(inputs).map(([k,input])=>[k,input.value]));
            const files={imagenPrincipal:principal.files[0],imagenesAdicionales:Array.from(gallery.files),archivoZip:zip.files[0]};
            action(async()=> { await api.guardar(p.id,datos,files,notice); await seller(); notice('Corrección guardada. Puedes enviarla a revisión.'); });
        });
        button('Volver sin guardar',seller); notice('Puedes editar esta plantilla. Guardar no la publica ni la envía.');
    }
    async function admin() {
        const rows=await api.pendientes(); clear();
        button('Pagos y ventas',pagosAdmin); button('Solicitudes de retiro',retirosAdmin); button('Configurar Yape',configurarYape);
        button('Usuarios',usuarios);button('Mi perfil',perfil);
        if(!rows.length) area.append(el('p','No hay plantillas pendientes de revisión.'));
        for(const p of rows) {
            const c=card(p); c.append(el('p','Enviada: '+new Date(p.enviada_revision_at).toLocaleString('es-PE')));
            button('Revisar plantilla',async()=> {
                clear(); area.append(el('h2',p.nombre),el('p','Vendedor: '+p.vendedor_id),el('p',money(p.precio)),el('p','Referencia: '+p.id));
                description(p,area); await preview(p,area);
                button('Descargar ZIP para revisión',async()=> {
                    const blob=await api.zipRevision(p.id), url=URL.createObjectURL(blob);
                    const a=link('Descargar',url); a.download='revision-'+p.id+'.zip'; area.append(a); a.click(); a.remove();
                    setTimeout(()=>URL.revokeObjectURL(url),60000); notice('ZIP obtenido con tu permiso de administrador.');
                });
                const motivo=el('textarea'); motivo.placeholder='Motivo obligatorio para rechazar'; motivo.setAttribute('aria-label','Motivo del rechazo'); area.append(motivo);
                button('Aprobar y publicar',async()=> { if(!confirm('¿Aprobar y publicar esta plantilla?')) return; await api.revisar(p.id,'publicada'); await admin(); notice('Plantilla publicada.'); });
                button('Rechazar',async()=> { await api.revisar(p.id,'rechazada',motivo.value); await admin(); notice('Plantilla rechazada. El vendedor puede corregirla.'); });
                button('Volver',admin); notice('Revisa los datos, las imágenes, la demo y el archivo antes de decidir.');
            },c);
        }
        notice(rows.length+' envío(s) pendiente(s).');
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
        const rows=filtered(await api.publicadas()); clear(); area.className='templates-grid';
        if(!rows.length) area.append(el('p','No hay plantillas publicadas que coincidan con tu búsqueda.'));
        for(const p of rows) { const c=card(p); c.append(link('Ver detalles','plantilla.html?id='+encodeURIComponent(p.id))); photo(p.imagen_principal,c); }
        notice(rows.length+' plantilla(s) publicada(s).');
    }
    async function detail() {
        const p=await api.detalle(new URLSearchParams(location.search).get('id')); clear();
        if(!p) { notice('Plantilla no disponible o aún no publicada.'); area.append(link('Volver al catálogo','catalogo.html')); return; }
        area.append(el('h1',p.nombre),el('p',money(p.precio))); description(p,area); await preview(p,area);
        button('Guardar en favoritos',async()=>{ await api.favorito(p.id,true); notice('Guardada en tus favoritos.'); });
        if(p.vendedor_id)area.append(link('Ver vendedor','vendedor.html?id='+encodeURIComponent(p.vendedor_id)));
        button('Comprar con Yape',async()=>{const order=await pay.crear(p.id);location.href='compra.html?pedido='+encodeURIComponent(order.id);});
        button('Ver mi panel',()=>redirigirSegunRol()); notice('Plantilla publicada.');
    }
    async function buyer() {
        const favs=await api.favoritos(), orders=await pay.compras(); clear();
        area.append(el('h2','Mis compras y pedidos'));
        if(!orders.length) area.append(el('p','Todavía no tienes pedidos.'));
        for(const o of orders) {
            const c=el('article',undefined,'form-container'); c.append(el('h3',o.plantilla_nombre),el('p',money(o.monto)+' — '+o.estado_pago));area.append(c);
            button(o.estado_pago==='verificado'?'Ver compra / descargar':'Ver pedido / pagar',()=>checkout(o.id),c);
        }
        button('Historial de movimientos',historial);
        button('Mi perfil',perfil);
        area.append(el('h2','Mis favoritos'));
        if(!favs.length) area.append(el('p','Todavía no guardaste favoritos.'));
        for(const f of favs) {
            const p=await api.detalle(f.plantilla_id), c=p?card(p):el('article','Plantilla ya no disponible');
            if(!p) area.append(c); else c.append(link('Ver plantilla','plantilla.html?id='+p.id));
            button('Quitar de favoritos',async()=>{await api.favorito(f.plantilla_id,false); await buyer();},c);
        }
        notice('Información de tu cuenta actualizada.');
    }
    async function saveBlob(blob,name) {
        const url=URL.createObjectURL(blob),a=link('Descargar',url); a.download=name;area.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
    async function checkout(id) {
        const o=await pay.pedido(id);clear();area.append(el('h2',o.plantilla_nombre),el('p','Pedido: '+o.id),el('p','Total: '+money(o.monto)),el('p','Estado: '+o.estado_pago));
        if(o.estado_pago==='verificado') {
            button('Descargar ZIP',async()=>{await saveBlob(await pay.descargar(o.id),'plantilla-'+o.plantilla_id+'.zip');notice('Descarga autorizada por tu compra verificada.');});
        } else if(o.estado_pago==='pendiente' && o.enviada_pago_at) {
            area.append(el('p','Comprobante recibido. Un administrador verificará el abono. No vuelvas a pagar.'));
        } else {
            if(o.motivo_rechazo) area.append(el('p','Motivo del rechazo: '+o.motivo_rechazo));
            area.append(el('h3','Pago por Yape'),el('p','Número: '+o.yape_numero),el('p','Titular: '+o.yape_titular),
                el('p','Yapea exactamente '+money(o.monto)+' y verifica el titular antes de confirmar. Adjunta la captura de la operación. Si ya pagaste, no repitas el pago: corrige el comprobante.'));
            const form=el('form'),file=field(form,'Comprobante JPG, PNG o WebP (máximo 5 MB)','comprobante',null,'file');file.accept='.jpg,.jpeg,.png,.webp';file.required=true;
            const send=el('button','Enviar comprobante','btn btn-primary');send.type='submit';form.append(send);area.append(form);
            form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const selected=file.files[0];
                action(async()=>{await pay.subir(o.id,selected,notice);await checkout(o.id);notice('Comprobante recibido: pendiente de verificación.');});});
            button('Recuperar último comprobante',async()=>{await pay.recuperar(o.id);await checkout(o.id);});
        }
        button('Mis compras',buyer);notice('Pedido actualizado.');
    }
    async function historial() {
        const rows=await pay.historial();clear();area.append(el('h2','Historial'));
        for(const r of rows)area.append(el('p',new Date(r.created_at).toLocaleString('es-PE')+' — '+r.entidad+' — '+r.accion+' — '+(r.detalle||'')));
        if(!rows.length)area.append(el('p','Sin movimientos.'));button('Volver',reload);notice('Historial registrado en el servidor.');
    }
    async function configurarYape() {
        const c=await pay.config();clear();area.append(el('h2','Destino de los pagos por Yape'));
        const form=el('form'),numero=field(form,'Número Yape de la plataforma','numero',c.yape_numero||''),titular=field(form,'Titular que verá el comprador','titular',c.yape_titular||'');
        numero.pattern='9[0-9]{8}';numero.required=true;titular.required=true;
        const b=el('button','Guardar destino Yape','btn btn-primary');b.type='submit';form.append(b);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const n=numero.value,t=titular.value;
            action(async()=>{if(!confirm('¿Confirmas que este es el destino real de los pagos? Los pedidos nuevos usarán estos datos.'))return;await pay.configurar(n,t);await admin();notice('Destino Yape configurado.');});});
        button('Volver',admin);notice(c.activo?'Los pedidos existentes conservan su destino original.':'Compras bloqueadas hasta configurar el destino real.');
    }
    async function pagosAdmin() {
        const rows=await pay.pedidosAdmin();clear();area.append(el('h2','Pagos y ventas'));
        const approved=rows.filter(o=>o.estado_pago==='verificado');
        area.append(el('p','Ventas verificadas: '+money(approved.reduce((n,o)=>n+Number(o.monto),0))+' · Plataforma: '+money(approved.reduce((n,o)=>n+Number(o.comision_plataforma),0))));
        if(!rows.length)area.append(el('p','No hay pedidos.'));
        for(const o of rows) {
            const c=el('article',undefined,'form-container');area.append(c);c.append(el('h3',o.plantilla_nombre),el('p',o.id+' — '+money(o.monto)+' — '+o.estado_pago),el('p','20% plataforma: '+money(o.comision_plataforma)+' · 80% vendedor: '+money(o.ingreso_vendedor)));
            if(o.comprobante_url) button('Ver comprobante',async()=>{
                const blob=await pay.evidencia(o.comprobante_url),url=URL.createObjectURL(blob);urls.push(url);const img=el('img');img.src=url;img.alt='Comprobante presentado';img.style.maxWidth='100%';c.append(img);notice('Compara la imagen con el abono real en Yape. La captura por sí sola no confirma el pago.');
            },c);
            if(o.estado_pago==='pendiente' && o.enviada_pago_at) {
                c.append(el('p','Destino: '+o.yape_numero+' / '+o.yape_titular));
                const ref=field(c,'Fecha y número único de operación Yape, o motivo para rechazar','ref-'+o.id,'');
                button('Confirmar abono y habilitar descarga',async()=>{
                    if(!confirm('¿Comprobaste el ingreso real de '+money(o.monto)+' al Yape indicado? Esta aprobación habilita el ZIP y acredita el 80% al vendedor.'))return;
                    await pay.revisar(o.id,true,ref.value);await pagosAdmin();notice('Pago aprobado y descarga habilitada.');
                },c);
                button('Rechazar comprobante',async()=>{await pay.revisar(o.id,false,ref.value);await pagosAdmin();notice('Comprobante rechazado; el comprador puede corregirlo.');},c);
            }
        }
        button('Revisión de plantillas',admin);notice('Pedidos consultados. Solo un abono real debe aprobarse.');
    }
    async function finanzas() {
        const orders=await pay.ventas(),withdrawals=await pay.retiros(),b=pay.balance(orders,withdrawals);clear();
        area.append(el('h2','Ventas y ganancias'),el('p','Ganado (80%): '+money(b.total)+' · Reservado: '+money(b.reservado)+' · Pagado: '+money(b.pagado)+' · Disponible: '+money(b.disponible)));
        for(const o of orders)area.append(el('p',o.plantilla_nombre+' — '+o.estado_pago+' — Venta '+money(o.monto)+' — Tu parte '+money(o.ingreso_vendedor)));
        area.append(el('h3','Solicitar retiro por Yape (mínimo S/50)'));
        const form=el('form'),amount=field(form,'Monto (S/)','retiro-monto','50','number'),number=field(form,'Tu número Yape','retiro-numero',''),name=field(form,'Titular','retiro-titular','');
        amount.min=50;amount.step='0.01';amount.required=true;number.pattern='9[0-9]{8}';number.required=true;name.required=true;
        const send=el('button','Solicitar retiro','btn btn-primary');send.type='submit';form.append(send);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const a=Number(amount.value),n=number.value,t=name.value;
            action(async()=>{await pay.solicitar(a,n,t);await finanzas();notice('Solicitud registrada. El saldo queda reservado hasta su resolución.');});});
        area.append(el('h3','Mis retiros'));
        for(const r of withdrawals)area.append(el('p',money(r.monto)+' — '+r.estado+' — '+(r.motivo_rechazo||r.referencia_pago||'')));
        button('Historial',historial);button('Mis plantillas',seller);notice('El saldo se calcula con ventas verificadas y retiros reservados o pagados.');
    }
    async function retirosAdmin() {
        const rows=await pay.retiros(true);clear();area.append(el('h2','Retiros de vendedores'));
        if(!rows.length)area.append(el('p','Sin solicitudes.'));
        for(const r of rows) {
            const c=el('article',undefined,'form-container');area.append(c);c.append(el('h3',money(r.monto)+' — '+r.estado),el('p','Vendedor: '+r.vendedor_id),el('p','Yape: '+r.destino_numero+' · '+r.destino_titular));
            if(['pendiente','aprobado'].includes(r.estado)) {
                const ref=field(c,'Motivo de rechazo o referencia de la transferencia realizada','retiro-ref-'+r.id,'');
                if(r.estado==='pendiente')button('Aprobar solicitud',async()=>{await pay.revisarRetiro(r.id,'aprobado','');await retirosAdmin();},c);
                button('Rechazar y liberar saldo',async()=>{await pay.revisarRetiro(r.id,'rechazado',ref.value);await retirosAdmin();},c);
                if(r.estado==='aprobado')button('Registrar transferencia ya realizada',async()=>{
                    if(!confirm('¿Ya transferiste '+money(r.monto)+' al destino indicado? Esto registra el pago; no realiza una transferencia.'))return;
                    await pay.revisarRetiro(r.id,'pagado',ref.value);await retirosAdmin();notice('Transferencia registrada.');
                },c);
            } else c.append(el('p',r.motivo_rechazo||r.referencia_pago||''));
        }
        button('Volver',admin);notice('Las transferencias se realizan personalmente fuera de la plataforma.');
    }
    async function usuarios() {
        const rows=await api.usuarios();clear();area.append(el('h2','Usuarios'));
        const search=field(area,'Buscar por nombre, ID o rol','usuario-busqueda',''),list=el('div');area.append(list);
        const render=()=>{list.replaceChildren();for(const p of rows.filter(p=>(p.nombre_completo+' '+p.id+' '+p.rol).toLowerCase().includes(search.value.toLowerCase()))) {
            const c=el('article',undefined,'form-container');list.append(c);c.append(el('h3',p.nombre_completo || 'Sin nombre'),el('p',p.id+' — '+p.rol));
            const select=el('select');select.setAttribute('aria-label','Rol de '+(p.nombre_completo||p.id));
            for(const role of ['comprador','vendedor','admin'])select.add(new Option(role,role));select.value=p.rol;c.append(select);
            button('Guardar rol',async()=>{if(select.value===p.rol)return;if(!confirm('¿Cambiar el rol de esta cuenta a '+select.value+'? Cambiarán sus permisos de acceso.'))return;
                await api.cambiarRol(p.id,select.value);await usuarios();notice('Rol actualizado mediante la función administrativa protegida.');},c);
        }};search.addEventListener('input',render);render();button('Volver',admin);notice(rows.length+' perfiles registrados. No se muestran contraseñas ni credenciales.');
    }
    async function perfil() {
        const p=await api.miPerfil();clear();area.append(el('h2','Mi perfil'),el('p','Rol: '+p.rol));
        const form=el('form'),name=field(form,'Nombre','perfil-nombre',p.nombre_completo),bio=field(form,'Biografía','perfil-bio',p.bio,'textarea');name.required=true;name.maxLength=120;bio.maxLength=2000;
        const b=el('button','Guardar perfil','btn btn-primary');b.type='submit';form.append(b);area.append(form);
        form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const datos={nombre_completo:name.value,bio:bio.value};action(async()=>{await api.miPerfil(datos);notice('Perfil guardado.');});});
        button('Volver',reload);notice('Puedes actualizar tu nombre y biografía.');
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
        document.getElementById('market-reload').addEventListener('click',()=>{if(!busy) location.reload();});
        try {
            if(['vendedor','admin','comprador','compra'].includes(mode) && !await window.accesoPagina) return;
            cats=await api.categorias();
            const select=document.getElementById('category-filter');
            if(select) {
                select.replaceChildren(new Option('Todas las categorías','')); cats.forEach(c=>select.add(new Option(c.nombre,String(c.id))));
                const params=new URLSearchParams(location.search); const cat=params.get('category');
                select.value=cats.find(c=>String(c.id)===cat || c.nombre===cat)?.id || '';
                document.getElementById('search-catalog').value=params.get('search') || '';
                document.getElementById('apply-filters').addEventListener('click',()=>action(catalog));
                document.getElementById('search-catalog').addEventListener('keydown',e=>{if(e.key==='Enter') {e.preventDefault(); action(catalog);}});
            }
            await reload();
        } catch(e) { notice(e.message || 'No se pudo cargar. Pulsa Actualizar para reintentar.'); }
    });
    window.addEventListener('pagehide',()=>urls.forEach(u=>URL.revokeObjectURL(u)));
})();
