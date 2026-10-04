const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

test('regresión comprador y pagos con backend simulado, sin pagos reales',async t=>{
 const root=path.resolve(__dirname,'..');
 const withoutPublicShell=s=>s.replace(/<nav class="nav-menu"[^>]*>[\s\S]*?<\/nav>/,'').replace(/<footer class="footer">[\s\S]*?<\/footer>/,'').replace(/\s*<link rel="stylesheet" href="css\/pillars.css[^>]*>/,'');
 for(const file of ['js/supabase.js','js/mercado-api.js','js/pagos-api.js']){
  const current=fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'),before=execFileSync('git',['show','683ba04:'+file],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
  assert.equal(file.endsWith('.html')?withoutPublicShell(current):current,file.endsWith('.html')?withoutPublicShell(before):before,file+' conserva lógica y contenido privado');
 }
 const source=fs.readFileSync(path.join(root,'js/mercado-ui.js'),'utf8').replaceAll('\r\n','\n'),before=execFileSync('git',['show','d2f14f2:js/mercado-ui.js'],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
 const fn=(s,name)=>{const start=s.indexOf('    async function '+name+'('),rest=s.slice(start+1),end=rest.search(/\n    (?:async )?function /);return end<0?rest:rest.slice(0,end);};
 for(const name of ['buyer','buyerDetail','checkout','buyerHistory','buyerProfile'])assert.equal(fn(source,name),fn(before,name),name+' sin cambios');
 const buyerId='11111111-1111-4111-8111-111111111111',adminId='22222222-2222-4222-8222-222222222222',sellerId='33333333-3333-4333-8333-333333333333',templateId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 const template={id:templateId,vendedor_id:sellerId,nombre:'Sitio de prueba',descripcion:'Descripción de la plantilla de prueba.',precio:80,categoria_id:1,tecnologias:['HTML','CSS'],demo_url:'https://example.test/demo',imagen_principal:'preview.png',estado:'publicada'};
 const db={categorias:[{id:1,nombre:'Negocios'}],plantillas:[template],imagenes_plantilla:[{plantilla_id:templateId,url:'extra.png',orden:1}],favoritos:[],pedidos:[],movimientos_auditoria:[],perfiles:[{id:buyerId,rol:'comprador',nombre_completo:'Ana Pérez',bio:''},{id:adminId,rol:'admin',nombre_completo:'Admin'}]};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 let downloads=0,reviews=0;
 const movement=(accion,detalle='')=>db.movimientos_auditoria.push({id:db.movimientos_auditoria.length+1,entidad:'pedido',entidad_id:orderId,propietario_id:buyerId,accion,detalle,created_at:new Date(Date.now()+db.movimientos_auditoria.length*1000).toISOString()});
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/__test'){
   let body='';for await(const chunk of req)body+=chunk;
   const q=JSON.parse(body);let data=null,error=null;
   if(q.kind==='query'){
    let rows=(db[q.table] || []).filter(r=>q.filters.every(([k,v])=>r[k]===v) && (!q.notNull || r[q.notNull]!=null));
    if(q.operation==='insert'){data={id:'favorite',...q.values};db[q.table].push(data);}
    else if(q.operation==='delete'){db[q.table]=db[q.table].filter(r=>!rows.includes(r));data=rows;}
    else if(q.operation==='update'){for(const row of rows)Object.assign(row,q.values);data=rows;}
    else data=rows;
    if(q.single)data=Array.isArray(data)?data[0]||null:data;
   } else if(q.kind==='rpc'){
    const o=db.pedidos[0];
    if(q.name==='tembora_crear_pedido'){
     if(!o){db.pedidos.push({id:orderId,plantilla_id:templateId,plantilla_nombre:template.nombre,comprador_id:buyerId,vendedor_id:sellerId,monto:80,comision_plataforma:16,ingreso_vendedor:64,estado_pago:'pendiente',enviada_pago_at:null,yape_numero:'999999999',yape_titular:'Cuenta de prueba',zip_path:'private/internal/source.zip',created_at:new Date().toISOString()});movement('creado');}
     data=orderId;
    }else if(q.name==='tembora_enviar_comprobante'){
     Object.assign(o,{estado_pago:'pendiente',comprobante_url:q.args.p_ruta,enviada_pago_at:new Date().toISOString(),motivo_rechazo:null});movement('comprobante_enviado',q.args.p_ruta);data=orderId;
    }else if(q.name==='tembora_revisar_pago'){
     reviews++;Object.assign(o,{estado_pago:q.args.p_aprobar?'verificado':'rechazado',revisado_por:adminId,revisado_at:new Date().toISOString(),operacion_yape:q.args.p_aprobar?q.args.p_referencia:null,motivo_rechazo:q.args.p_aprobar?null:q.args.p_referencia});movement(q.args.p_aprobar?'pago_verificado':'pago_rechazado',q.args.p_referencia);data=orderId;
    }else error={message:'RPC inesperada'};
   }else if(q.kind==='download'){
    if(q.bucket==='plantillas-zip'){if(db.pedidos[0]?.estado_pago!=='verificado')error={message:'Descarga no autorizada'};else downloads++;}
    data=q.bucket==='plantillas-zip'?'zip':png.toString('base64');
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error}));return;
  }
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
 const sdk=`(()=>{
  const role=()=>localStorage.getItem('test-role')||'comprador';const user=()=>({id:role()==='admin'?'${adminId}':'${buyerId}',email:'ana@example.test',app_metadata:{provider:'email'}});
  const send=q=>fetch('/__test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)}).then(r=>r.json());
  const client={auth:{getSession:async()=>({data:{session:{user:user(),access_token:'test'}}}),getUser:async()=>({data:{user:user()}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   from:table=>{const state={kind:'query',table,filters:[]};const run=()=>send(state);const q={select:()=>q,eq:(k,v)=>{state.filters.push([k,v]);return q;},not:(k,op,v)=>{if(op!=="is"||v!==null)throw new Error("Unsupported fixture filter");state.notNull=k;return q;},order:()=>q,range:run,single:()=>{state.single=true;return run();},maybeSingle:()=>{state.single=true;return run();},insert:values=>{state.operation='insert';state.values=values;return q;},delete:()=>{state.operation='delete';return q;},update:values=>{state.operation='update';state.values=values;return q;},then:(ok,err)=>run().then(ok,err)};return q;},
   rpc:(name,args)=>send({kind:'rpc',name,args}),storage:{from:bucket=>({upload:async()=>({data:{}}),download:async path=>{const r=await send({kind:'download',bucket,path});return r.error?r:{data:bucket==='plantillas-zip'?new Blob(['PK-test']):new Blob([Uint8Array.from(atob(r.data),c=>c.charCodeAt(0))],{type:'image/png'})};}})}};
  window.supabase={createClient:()=>client};
 })();`;
 const context=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true});
 context.setDefaultTimeout(15000);
 await context.route('https://**/*',route=>route.fulfill({contentType:route.request().url().includes('supabase-js')?'text/javascript':'text/plain',body:route.request().url().includes('supabase-js')?sdk:''}));
 const buyer=await context.newPage(),admin=await context.newPage(),errors=[];
 for(const page of [buyer,admin]){page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());}
 const base='http://127.0.0.1:'+server.address().port+'/';
 const ready=page=>page.waitForFunction(()=>!document.documentElement.hasAttribute('data-auth-pending')&&document.documentElement.dataset.sessionState==='authenticated');
 async function go(page,file){await page.goto(base+file);await ready(page);}
 const btn=(page,name)=>page.getByRole('button',{name,exact:true});
 await go(buyer,'panel-comprador.html');await buyer.getByText('Todavía no tienes compras ni pedidos. Explora las plantillas para comenzar.',{exact:true}).waitFor();
 assert.deepEqual(await buyer.locator('.nav-menu a').allTextContents(),['Inicio','Plantillas','Para negocios','Webs completas','Cómo funciona','Vender','Contacto']);
 assert.equal(await buyer.locator('#user-panel-btn').getAttribute('aria-current'),'page');assert.equal(await buyer.locator('.whatsapp-float').count(),0);
 await go(buyer,'plantilla.html?id='+templateId);await btn(buyer,'Guardar en favoritos').click();await buyer.getByText('Guardada en favoritos',{exact:true}).waitFor();
 assert.equal(await buyer.locator('[data-detail-panel]').count(),0);assert.equal(await buyer.locator('.account-gallery img').count(),2);assert.equal(await buyer.getByRole('link',{name:'Ver demo',exact:true}).count(),1);
 await btn(buyer,'Quitar de favoritos').click();await buyer.getByText('Eliminada de favoritos',{exact:true}).waitFor();await btn(buyer,'Guardar en favoritos').click();await buyer.getByText('Guardada en favoritos',{exact:true}).waitFor();
 await go(buyer,'panel-comprador.html');await btn(buyer,'Quitar de favoritos').waitFor();await buyer.locator('.account-card img').waitFor();assert.equal(await buyer.locator('.account-card img').count(),1);
 await buyer.getByRole('link',{name:'Ver plantilla',exact:true}).click();await btn(buyer,'Comprar con Yape').click();await buyer.waitForURL('**/compra.html?pedido=*');await buyer.getByRole('heading',{name:'Completa tu compra',exact:true}).waitFor();
 assert.equal(await buyer.locator('.whatsapp-float').count(),0);assert.equal(await btn(buyer,'Descargar ZIP').count(),0);
 const upload={name:'comprobante.png',mimeType:'image/png',buffer:png};await buyer.locator('input[type="file"]').setInputFiles(upload);await btn(buyer,'Enviar comprobante').click();await buyer.getByRole('heading',{name:'Pago en revisión',exact:true}).waitFor();
 assert.equal(await buyer.locator('input[type="file"]').count(),0);assert.equal(await buyer.getByText('Pendiente de verificación',{exact:true}).count(),1);
 await go(buyer,'plantilla.html?id='+templateId);await buyer.getByRole('link',{name:'Ver estado del pago',exact:true}).waitFor();assert.equal(await btn(buyer,'Comprar con Yape').count(),0);
 await buyer.getByRole('link',{name:'Ver estado del pago',exact:true}).click();await buyer.getByRole('heading',{name:'Pago en revisión',exact:true}).waitFor();
 // A separate context keeps the administrator identity independent from the buyer.
 const adminContext=await browser.newContext({viewport:{width:1365,height:900}});await adminContext.addInitScript(()=>localStorage.setItem('test-role','admin'));
 adminContext.setDefaultTimeout(15000);
 await adminContext.route('https://**/*',route=>route.fulfill({contentType:route.request().url().includes('supabase-js')?'text/javascript':'text/plain',body:route.request().url().includes('supabase-js')?sdk:''}));
 const reviewer=await adminContext.newPage();reviewer.on('pageerror',e=>errors.push(e.message));reviewer.on('dialog',d=>d.accept());
 await go(reviewer,'admin.html');
 await btn(reviewer,'Pagos y ventas').waitFor({timeout:8000}).catch(async error=>{error.message+='\nEstado de Admin: '+await reviewer.locator('body').innerText()+'\nErrores: '+errors.join('; ');throw error;});
 await btn(reviewer,'Pagos y ventas').click();await reviewer.getByRole('heading',{name:'Pagos y ventas',exact:true}).waitFor();
 assert.equal(await reviewer.locator('.whatsapp-float').count(),0);await btn(reviewer,'Ver comprobante').click();await reviewer.getByAltText('Comprobante presentado').waitFor();
 await btn(reviewer,'Rechazar comprobante').click();assert.equal(reviews,0);
 await reviewer.getByLabel('Motivo para rechazar el comprobante').fill('Captura incompleta');await btn(reviewer,'Rechazar comprobante').click();await reviewer.getByText('Motivo: Captura incompleta',{exact:true}).waitFor();
 await buyer.getByText('Motivo del rechazo: Captura incompleta',{exact:true}).waitFor();
 await go(buyer,'plantilla.html?id='+templateId);await buyer.getByRole('link',{name:'Corregir comprobante',exact:true}).waitFor();assert.equal(await btn(buyer,'Comprar con Yape').count(),0);
 await buyer.getByRole('link',{name:'Corregir comprobante',exact:true}).click();await btn(buyer,'Recuperar último comprobante').waitFor();
 await buyer.locator('input[type="file"]').setInputFiles(upload);await btn(buyer,'Enviar comprobante').click();await buyer.getByRole('heading',{name:'Pago en revisión',exact:true}).waitFor();
 await btn(reviewer,'Revisión de plantillas').click();await btn(reviewer,'Pagos y ventas').click();await reviewer.getByLabel('Código/número de operación Yape').fill('PRUEBA123');await btn(reviewer,'Confirmar abono y habilitar descarga').click();
 await reviewer.getByText('Pago aprobado y descarga habilitada.',{exact:true}).waitFor();assert.equal(await btn(reviewer,'Confirmar abono y habilitar descarga').count(),0);assert.equal(await btn(reviewer,'Rechazar comprobante').count(),0);
 assert.deepEqual(await reviewer.locator('.account-payment-group > h2').allTextContents(),['Pendientes','Verificados','Rechazados']);
 assert.equal(await reviewer.locator('.account-payment-group').nth(1).locator('.order-card').count(),1);
 assert.equal(await reviewer.locator('.account-payment-group').nth(0).locator('.order-card').count(),0);
 assert.equal(await reviewer.locator('#market-reload').innerText(),'Actualizar');
 await btn(buyer,'Descargar ZIP').waitFor();assert.equal(await buyer.locator('input[type="file"]').count(),0);assert.match(await buyer.locator('#market-content').innerText(),/PRUEBA123/);
 const download=buyer.waitForEvent('download');await btn(buyer,'Descargar ZIP').click();await download;assert.equal(downloads,1);
 await go(buyer,'plantilla.html?id='+templateId);await buyer.getByRole('link',{name:'Ver compra',exact:true}).waitFor();assert.equal(await btn(buyer,'Comprar con Yape').count(),0);
 await go(buyer,'panel-comprador.html');await btn(buyer,'Ver compra / Descargar ZIP').waitFor();await btn(buyer,'Historial de movimientos').click();await buyer.getByRole('heading',{name:'Historial de movimientos',exact:true}).waitFor();
 const history=await buyer.locator('#market-content').innerText();for(const label of ['Pedido creado','Comprobante enviado','Pago verificado','PRUEBA123'])assert.ok(history.includes(label),label);
 assert.ok(!history.includes(orderId));assert.ok(!history.includes('private/'));assert.ok(!history.includes('.png'));assert.equal(await buyer.locator('.account-history h3').first().innerText(),'Pago verificado');
 await btn(buyer,'Volver a Mi panel').click();await btn(buyer,'Mi perfil').click();await buyer.getByLabel('Correo',{exact:true}).waitFor();assert.equal(await buyer.getByLabel('Correo',{exact:true}).inputValue(),'ana@example.test');assert.equal(await buyer.getByLabel('Correo',{exact:true}).evaluate(e=>e.readOnly),true);
 await buyer.getByLabel('Nombre',{exact:true}).fill('Ana Actualizada');await btn(buyer,'Guardar cambios').click();await buyer.getByText('Perfil guardado.',{exact:true}).waitFor();assert.equal(db.perfiles[0].nombre_completo,'Ana Actualizada');assert.equal(db.perfiles[0].rol,'comprador');
 await btn(buyer,'Volver a Mi panel').click();await btn(buyer,'Ver compra / Descargar ZIP').waitFor();
 await buyer.setViewportSize({width:390,height:844});assert.ok(await buyer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await buyer.screenshot({path:path.join(process.env.TEMP,'taviku-comprador-final.png'),fullPage:true});
 await reviewer.setViewportSize({width:390,height:844});assert.ok(await reviewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
});
