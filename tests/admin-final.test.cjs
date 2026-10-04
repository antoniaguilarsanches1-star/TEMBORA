const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

test('regresión final Admin: navegación, revisión, pagos, retiros, destino, usuarios y perfil',async t=>{
 const root=path.resolve(__dirname,'..');
 const sellerId='11111111-1111-4111-8111-111111111111',adminId='22222222-2222-4222-8222-222222222222',publishedId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const baseTemplate={nombre:'Publicada de prueba',descripcion:'Descripción válida para revisión de plantilla. '.repeat(4),precio:80,categoria_id:1,tecnologias:['HTML','CSS'],demo_url:'https://example.test/demo',vendedor_id:sellerId,imagen_principal:'preview.png',archivo_zip_path:'template.zip',created_at:'2026-10-01T12:00:00Z'};
 const db={categorias:[{id:1,nombre:'Negocios'}],plantillas:[{...baseTemplate,id:publishedId,estado:'publicada',enviada_revision_at:'2026-10-01T12:00:00Z'}],imagenes_plantilla:[],perfiles:[{id:sellerId,rol:'vendedor',nombre_completo:'Ana Vendedora',bio:'Creo sitios web'},{id:adminId,rol:'admin',nombre_completo:'Admin'}],pedidos:[{vendedor_id:sellerId,plantilla_nombre:'Publicada de prueba',monto:49,ingreso_vendedor:39.2,estado_pago:'verificado',created_at:'2026-10-01T12:00:00Z'}],retiros:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',vendedor_id:sellerId,estado:'pendiente',monto:50,destino_numero:'999999999',destino_titular:'Ana Vendedora',created_at:'2026-10-01T12:00:00Z'},{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',vendedor_id:sellerId,estado:'pendiente',monto:60,destino_numero:'999999999',destino_titular:'Ana Vendedora',created_at:'2026-10-02T12:00:00Z'}],configuracion_pagos:[{id:true,activo:true,yape_numero:'999999999',yape_titular:'Taviku Actual'}],webs_completas:[]};
 let sends=0,reviews=0,uploads=0,downloads=0;const rpcCalls=[];
 const png=fs.readFileSync(path.join(root,'tests/fixtures/recorrido-vendedor/temporal.png'));
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/__fixture'){
   let body='';for await(const c of req)body+=c;const q=JSON.parse(body);let data=null,error=null;
   if(q.kind==='query'){
    let rows=(db[q.table]||[]).filter(r=>q.filters.every(([k,v])=>r[k]===v)&&(!q.notNull||r[q.notNull]!=null));
    if(q.operation==='insert'){
     const values=Array.isArray(q.values)?q.values:[q.values];data=values.map(v=>({...v,id:v.id||crypto.randomUUID(),created_at:new Date().toISOString(),estado:v.estado||'pendiente',updated_at:new Date().toISOString()}));db[q.table].push(...data);
    }else if(q.operation==='update'){rows.forEach(r=>Object.assign(r,q.values,{updated_at:new Date().toISOString()}));data=rows;}
    else data=rows;
    if(q.single)data=Array.isArray(data)?data[0]||null:data;
   }else if(q.kind==='rpc'){
    rpcCalls.push(q);const p=db.plantillas.find(p=>p.id===q.args.p_plantilla);
    if(q.name==='tembora_enviar_plantilla'&&q.role==='vendedor'&&p?.vendedor_id===sellerId&&(p.estado==='rechazada'||!p.enviada_revision_at)){
     sends++;Object.assign(p,{estado:'pendiente',enviada_revision_at:new Date().toISOString(),revisada_at:null,motivo_rechazo:null});data=p.id;
    }else if(q.name==='tembora_revisar_plantilla'&&q.role==='admin'&&p?.estado==='pendiente'&&p.vendedor_id!==adminId){
     if(q.args.p_estado==='rechazada'&&!q.args.p_motivo?.trim())error={message:'Motivo obligatorio'};
     else {reviews++;const now=new Date().toISOString();Object.assign(p,{estado:q.args.p_estado,motivo_rechazo:q.args.p_motivo,revisada_at:now,updated_at:now});data=p.id;}
     }else if(q.name==='tembora_revisar_retiro'&&q.role==='admin'){
      const r=db.retiros.find(r=>r.id===q.args.p_retiro);if(!r||!['pendiente','aprobado'].includes(r.estado)||!['pagado','rechazado'].includes(q.args.p_estado)||q.args.p_referencia.trim().length<3)error={message:'Transición inválida'};
      else Object.assign(r,{estado:q.args.p_estado,pagado_at:q.args.p_estado==='pagado'?new Date().toISOString():null,referencia_pago:q.args.p_estado==='pagado'?q.args.p_referencia:null,motivo_rechazo:q.args.p_estado==='rechazado'?q.args.p_referencia:null});
    }else if(q.name==='tembora_configurar_yape'&&q.role==='admin'){Object.assign(db.configuracion_pagos[0],{yape_numero:q.args.p_numero,yape_titular:q.args.p_titular});}
    else if(q.name==='tembora_admin_cambiar_rol'&&q.role==='admin'&&q.args.p_usuario_id!==adminId){db.perfiles.find(p=>p.id===q.args.p_usuario_id).rol=q.args.p_nuevo_rol;}
    else error={message:'RPC no permitida en esta prueba'};
   }else if(q.kind==='upload'){uploads++;data={path:q.path};}
   else if(q.kind==='download'){downloads++;data=png.toString('base64');}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error}));return;
  }
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});t.after(()=>browser.close());
 const sdk=`(()=>{
  const role=()=>localStorage.getItem('fixture-role')||'vendedor';
  const user=()=>({id:role()==='admin'?'${adminId}':'${sellerId}',email:'ana@example.test',app_metadata:{provider:'email'}});
  const send=q=>fetch('/__fixture',{method:'POST',body:JSON.stringify({...q,role:role()})}).then(r=>r.json());
  const client={auth:{getSession:async()=>({data:{session:{user:user(),access_token:'test'}}}),getUser:async()=>({data:{user:user()}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   from:table=>{const state={kind:'query',table,filters:[]};const run=()=>send(state);const q={select:()=>q,eq:(k,v)=>{state.filters.push([k,v]);return q;},not:(k)=>{state.notNull=k;return q;},order:()=>q,range:run,single:()=>{state.single=true;return run();},maybeSingle:()=>{state.single=true;return run();},insert:values=>{state.operation='insert';state.values=values;return q;},update:values=>{state.operation='update';state.values=values;return q;},then:(ok,err)=>run().then(ok,err)};return q;},
   rpc:(name,args)=>send({kind:'rpc',name,args}),storage:{from:bucket=>({upload:path=>send({kind:'upload',bucket,path}),download:async path=>{const r=await send({kind:'download',bucket,path});return {data:new Blob([Uint8Array.from(atob(r.data),c=>c.charCodeAt(0))],{type:bucket==='plantillas-zip'?'application/zip':'image/png'})};}})}};window.supabase={createClient:()=>client};})();`;
 const errors=[],dialogs=[];
 async function context(role){const c=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true});await c.addInitScript(r=>localStorage.setItem('fixture-role',r),role);await c.route('https://**/*',route=>route.fulfill({contentType:route.request().url().includes('supabase-js')?'text/javascript':'text/plain',body:route.request().url().includes('supabase-js')?sdk:''}));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>{dialogs.push(d.message());d.accept();});return p;}
 const admin=await context('admin'),base='http://127.0.0.1:'+server.address().port+'/';
 const btn=n=>admin.getByRole('button',{name:n,exact:true});
 async function section(label){await admin.locator('#admin-nav').getByRole('button',{name:label,exact:true}).click();await admin.getByRole('heading',{name:label,exact:true}).waitFor();assert.equal(await admin.locator('#admin-nav [aria-current]').innerText(),label);assert.equal(await admin.locator('#admin-nav button').count(),6);}
 await admin.goto(base+'admin.html');await admin.getByText('No hay plantillas pendientes de revisión.',{exact:true}).waitFor();assert.equal(await admin.locator('.auth-buttons [aria-current]').innerText(),'Mi Panel');assert.equal(await admin.locator('.whatsapp-float').count(),0);
 // Ya publicada: no puede volver a aprobarse desde la cola.
 assert.equal(await btn('Aprobar y publicar').count(),0);
 db.plantillas.push({...baseTemplate,id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',nombre:'Revisar simulada',estado:'pendiente',enviada_revision_at:'2026-10-03T10:00:00Z'});
 await btn('Actualizar').click();await btn('Revisar plantilla').click();await btn('Aprobar y publicar').click();await admin.getByText('Plantilla publicada.',{exact:true}).waitFor();assert.equal(reviews,1);assert.equal(await btn('Aprobar y publicar').count(),0);
 await section('Pagos y ventas');assert.ok((await admin.locator('#market-content').innerText()).includes('Ana Vendedora'));assert.equal(await btn('Confirmar abono y habilitar descarga').count(),0);
 await section('Solicitudes de retiro');assert.equal(await btn('Aprobar solicitud').count(),0);assert.equal(await admin.locator('.admin-withdrawal').count(),2);
 let c=admin.locator('.admin-withdrawal').filter({hasText:'BBBBBBBB'});await c.getByRole('button',{name:'Rechazar y liberar saldo',exact:true}).click();assert.equal(rpcCalls.filter(q=>q.name==='tembora_revisar_retiro').length,0);
 await c.getByLabel('Motivo del rechazo',{exact:true}).fill('Destino incorrecto');await c.getByRole('button',{name:'Rechazar y liberar saldo',exact:true}).click();await admin.getByText('Retiro rechazado. Saldo liberado.',{exact:true}).waitFor();assert.equal(db.retiros[0].estado,'rechazado');assert.equal(await c.getByRole('button').count(),0);
 const released=await admin.evaluate(rows=>window.TemboraPagos.balance([{estado_pago:'verificado',ingreso_vendedor:200}],rows),db.retiros);assert.equal(released.reservado,60);assert.equal(released.disponible,140);
 c=admin.locator('.admin-withdrawal').filter({hasText:'CCCCCCCC'});await c.getByLabel('Código de operación Yape',{exact:true}).fill('OP-TEST-123');await c.getByRole('button',{name:'Registrar como pagado',exact:true}).click();await admin.getByText('Retiro pagado. Código y fecha registrados.',{exact:true}).waitFor();assert.equal(db.retiros[1].estado,'pagado');assert.ok(db.retiros[1].pagado_at);assert.equal(db.retiros[1].referencia_pago,'OP-TEST-123');assert.equal(await c.getByRole('button').count(),0);
 const paid=await admin.evaluate(rows=>window.TemboraPagos.balance([{estado_pago:'verificado',ingreso_vendedor:200}],rows),db.retiros);assert.equal(paid.reservado,0);assert.equal(paid.pagado,60);assert.equal(paid.disponible,140);assert.ok(!rpcCalls.some(q=>q.args.p_estado==='aprobado'));
 const previousOrders=JSON.stringify(db.pedidos);await section('Configurar Yape');await admin.getByLabel('Número Yape de la plataforma').fill('912345678');await admin.getByLabel('Titular que verá el comprador').fill('Cuenta Nueva');await btn('Guardar destino Yape').click();await admin.getByText('Destino Yape configurado.',{exact:true}).waitFor();assert.equal(db.configuracion_pagos[0].yape_numero,'912345678');assert.equal(JSON.stringify(db.pedidos),previousOrders);
 await admin.getByLabel('Titular que verá el comprador').fill('Cuenta123');assert.equal(await admin.locator('#market-content form').evaluate(e=>e.checkValidity()),false);
 await section('Usuarios');const self=admin.locator('.admin-user').filter({hasText:'Tu cuenta'});assert.equal(await self.locator('select').count(),0);assert.equal(await self.getByRole('button').count(),0);
 await admin.getByLabel('Buscar por nombre, correo, ID o rol').fill('vendedor');assert.equal(await admin.locator('.admin-user').count(),1);await admin.getByLabel('Rol de Ana Vendedora').selectOption('comprador');await btn('Guardar rol').click();await admin.getByText('Rol actualizado mediante la función administrativa protegida.',{exact:true}).waitFor();assert.equal(db.perfiles[0].rol,'comprador');assert.equal(db.perfiles[1].rol,'admin');
 await section('Mi perfil');assert.equal(await admin.getByLabel('Correo',{exact:true}).evaluate(e=>e.readOnly),true);assert.equal(await admin.locator('#market-content select').count(),0);await admin.getByLabel('Biografía',{exact:true}).fill('Administración de TAVIKU');await btn('Guardar cambios').click();await admin.getByText('Perfil guardado.',{exact:true}).waitFor();assert.equal(db.perfiles[1].bio,'Administración de TAVIKU');
 await btn('Actualizar').click();await admin.getByRole('heading',{name:'Mi perfil',exact:true}).waitFor();assert.equal(await admin.locator('#admin-nav [aria-current]').innerText(),'Mi perfil');
 await section('Solicitudes de retiro');const out=path.join(process.env.TEMP,'taviku-admin-final');fs.mkdirSync(out,{recursive:true});for(const width of [1365,390]){await admin.setViewportSize({width,height:900});assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await admin.screenshot({path:path.join(out,'admin-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);assert.equal(rpcCalls.filter(q=>q.name==='tembora_revisar_retiro').length,2);assert.equal(sends,0);
});
