(function(root,factory) {
    if(typeof module==='object' && module.exports) module.exports=factory;
    else root.TemboraPagos=factory({cliente:()=>supabaseClient,sesion:()=>verificarSesion(),uuid:()=>crypto.randomUUID(),
        memoria:{getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value),removeItem:key=>window.localStorage.removeItem(key)},
        imagen:(file)=>root.TemboraEnvios.validarImagen(file,'Comprobante')});
})(typeof window!=='undefined'?window:globalThis,function(d) {
    'use strict';
    const ok=r=>{if(!r || r.error) throw new Error(r?.error?.message || 'No se pudo confirmar la operación.');return r.data;};
    async function actor(role,expected) {
        const s=await d.sesion();
        if(!s.success || !s.user?.id || (role && s.rol!==role) || (expected && s.user.id!==expected)) throw new Error('Sesión no autorizada o cuenta cambiada.');
        return s.user.id;
    }
    async function rpc(name,args,role) {await actor(role);return ok(await d.cliente().rpc(name,args));}
    async function todos(table,filter) {
        const rows=[];
        for(let n=0;;n+=100) {let q=d.cliente().from(table).select('*').order('created_at',{ascending:false}).order('id');
            if(filter)q=q.eq(...filter);const page=ok(await q.range(n,n+99));rows.push(...page);if(page.length<100)return rows;}
    }
    async function compras() {const uid=await actor('comprador');return todos('pedidos',['comprador_id',uid]);}
    async function ventas() {const uid=await actor('vendedor');return todos('pedidos',['vendedor_id',uid]);}
    async function pedidosAdmin() {await actor('admin');return todos('pedidos');}
    async function retiros(admin=false) {const uid=await actor(admin?'admin':'vendedor');return todos('retiros',admin?null:['vendedor_id',uid]);}
    async function pedido(id) {const uid=await actor('comprador');return ok(await d.cliente().from('pedidos').select('*').eq('id',id).eq('comprador_id',uid).single());}
    async function crear(id) {const pid=await rpc('tembora_crear_pedido',{p_plantilla:id},'comprador');return pedido(pid);}
    async function configurar(numero,titular) {await rpc('tembora_configurar_yape',{p_numero:numero,p_titular:titular},'admin');}
    async function config() {await actor();return ok(await d.cliente().from('configuracion_pagos').select('activo,yape_numero,yape_titular').single());}
    async function subir(id,file,progress=()=>{}) {
        const uid=await actor('comprador'),p=await pedido(id),v=await d.imagen(file);
        if(p.estado_pago==='verificado' || (p.estado_pago==='pendiente' && p.enviada_pago_at)) throw new Error('El comprobante ya está en revisión o aprobado.');
        const path=uid+'/'+id+'/'+d.uuid()+'.'+v.ext;
        // Keep an operation receipt before uploading; a lost response is recoverable.
        d.memoria.setItem('tembora:comprobante:'+uid+':'+id,path);
        await actor('comprador',uid);progress('Subiendo comprobante privado…');
        ok(await d.cliente().storage.from('comprobantes').upload(path,file,{contentType:v.mime,upsert:false}));
        return recuperar(id);
    }
    async function recuperar(id) {
        const uid=await actor('comprador'),key='tembora:comprobante:'+uid+':'+id,path=d.memoria.getItem(key);
        if(!path) return pedido(id);
        await rpc('tembora_enviar_comprobante',{p_pedido:id,p_ruta:path},'comprador');
        const p=await pedido(id);
        if(p.comprobante_url!==path || !p.enviada_pago_at) throw new Error('No se confirmó la recepción. Comprueba nuevamente.');
        d.memoria.removeItem(key);return p;
    }
    async function evidencia(path) {await actor('admin');return ok(await d.cliente().storage.from('comprobantes').download(path));}
    async function revisar(id,aprobar,referencia) {
        await rpc('tembora_revisar_pago',{p_pedido:id,p_aprobar:aprobar,p_referencia:referencia},'admin');
        await actor('admin');
        const p=ok(await d.cliente().from('pedidos').select('*').eq('id',id).single());
        if(!p || p.estado_pago!==(aprobar?'verificado':'rechazado') || !p.revisado_por)
            throw new Error('No se pudo confirmar que la revisión quedó guardada. Actualiza el pedido antes de repetir.');
        return p;
    }
    async function descargar(id) {
        const p=await pedido(id);
        if(p.estado_pago!=='verificado' || !p.revisado_por) throw new Error('El pago todavía no está aprobado.');
        // Storage checks the verified purchase again, independently of this UI check.
        return ok(await d.cliente().storage.from('plantillas-zip').download(p.zip_path));
    }
    const solicitudesEnCurso=new Set();
    async function solicitar(monto,numero,titular) {
        const uid=await actor('vendedor'),key='tembora:retiro:'+uid;
        if(solicitudesEnCurso.has(uid)) throw new Error('Ya se está enviando una solicitud de retiro.');
        solicitudesEnCurso.add(uid);
        try {
            titular=String(titular || '').normalize('NFC').trim();
            if(!/^[0-9]{9}$/.test(numero)) throw new Error('Yape debe tener exactamente 9 dígitos, solo números.');
            if(titular.length<2 || !/^[\p{L} ]+$/u.test(titular)) throw new Error('El titular debe tener al menos 2 caracteres, solo letras y espacios.');
            let pending=d.memoria.getItem(key);
            const withdrawals=await retiros();
            // Recuperar una respuesta perdida antes de intentar reservar nuevamente.
            const anterior=withdrawals.find(r=>r.solicitud_id===pending);
            if(anterior) { d.memoria.removeItem(key);return anterior.id; }
            if(withdrawals.some(r=>['pendiente','aprobado'].includes(r.estado))) throw new Error('Ya tienes un retiro pendiente de resolución.');
            const disponible=balance(await ventas(),withdrawals).disponible;
            if(!Number.isFinite(disponible) || disponible<50) throw new Error('El saldo disponible debe alcanzar S/50.');
            if(!Number.isFinite(monto) || monto!==disponible) throw new Error('El saldo cambió. Actualiza y confirma el monto completo.');
            if(!pending) {pending=d.uuid();d.memoria.setItem(key,pending);}
            await actor('vendedor',uid);
            const id=ok(await d.cliente().rpc('tembora_solicitar_retiro',{p_solicitud:pending,p_monto:disponible,p_numero:numero,p_titular:titular}));
            d.memoria.removeItem(key);return id;
        } finally { solicitudesEnCurso.delete(uid); }
    }
    async function revisarRetiro(id,estado,ref) {
        await rpc('tembora_revisar_retiro',{p_retiro:id,p_estado:estado,p_referencia:ref},'admin');
        await actor('admin');
        const r=ok(await d.cliente().from('retiros').select('*').eq('id',id).single());
        if(!r || r.estado!==estado || (estado==='pagado' && (!r.pagado_at || !r.referencia_pago)))
            throw new Error('No se pudo confirmar la revisión del retiro. Actualiza antes de repetir.');
        return r;
    }
    async function historial() {const uid=await actor();return todos('movimientos_auditoria',['propietario_id',uid]);}
    function balance(orders,withdrawals) {
        const centavos=n=>Math.round(Number(n)*100);
        const total=orders.filter(o=>o.estado_pago==='verificado').reduce((s,o)=>s+centavos(o.ingreso_vendedor),0);
        const reservado=withdrawals.filter(r=>['pendiente','aprobado'].includes(r.estado)).reduce((s,r)=>s+centavos(r.monto),0);
        const pagado=withdrawals.filter(r=>r.estado==='pagado').reduce((s,r)=>s+centavos(r.monto),0);
        return {total:total/100,reservado:reservado/100,pagado:pagado/100,disponible:(total-reservado-pagado)/100};
    }
    return {compras,ventas,pedidosAdmin,retiros,pedido,crear,configurar,config,subir,recuperar,evidencia,revisar,descargar,solicitar,revisarRetiro,historial,balance};
});
