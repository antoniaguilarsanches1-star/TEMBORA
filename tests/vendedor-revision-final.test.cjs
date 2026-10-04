const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

test('regresión final única: vendedor → revisión → corrección → reenvío, sin pagos reales',async t=>{
 const root=path.resolve(__dirname,'..');
 const previous=file=>execFileSync('git',['show','d2f14f2:'+file],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
 for(const file of ['js/supabase.js','js/auth-oauth.js','js/mercado-api.js','js/pagos-api.js','js/plantillas-envio.js','panel-comprador.html','compra.html','plantilla.html'])assert.equal(fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'),previous(file),file+' intacto');
 const source=fs.readFileSync(path.join(root,'js/mercado-ui.js'),'utf8'),before=previous('js/mercado-ui.js');
 const fn=(s,name)=>{const start=s.indexOf('    async function '+name+'(');assert.ok(start>=0);const tail=s.slice(start+1),end=tail.search(/\n    (?:async )?function /);return end<0?tail:tail.slice(0,end);};
 for(const name of ['buyer','buyerDetail','checkout','buyerHistory','buyerProfile'])assert.equal(fn(source,name),fn(before,name),name+' intacto');
 assert.equal(execFileSync('git',['diff','d2f14f2','--','supabase'],{cwd:root,encoding:'utf8'}),'','Sin cambios de base de datos');
 const sellerId='11111111-1111-4111-8111-111111111111',adminId='22222222-2222-4222-8222-222222222222',publishedId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const baseTemplate={nombre:'Publicada de prueba',descripcion:'Descripción válida para revisión de plantilla. '.repeat(4),precio:80,categoria_id:1,tecnologias:['HTML','CSS'],demo_url:'https://example.test/demo',vendedor_id:sellerId,imagen_principal:'preview.png',archivo_zip_path:'template.zip',created_at:'2026-10-01T12:00:00Z'};
 const db={categorias:[{id:1,nombre:'Negocios'}],plantillas:[{...baseTemplate,id:publishedId,estado:'publicada',enviada_revision_at:'2026-10-01T12:00:00Z'}],imagenes_plantilla:[],perfiles:[{id:sellerId,rol:'vendedor',nombre_completo:'Ana Vendedora',bio:'Creo sitios web'},{id:adminId,rol:'admin',nombre_completo:'Admin'}],pedidos:[{vendedor_id:sellerId,plantilla_nombre:'Publicada de prueba',monto:49,ingreso_vendedor:39.2,estado_pago:'verificado',created_at:'2026-10-01T12:00:00Z'}],retiros:[],webs_completas:[]};
 let sends=0,reviews=0,uploads=0,downloads=0;
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
    const p=db.plantillas.find(p=>p.id===q.args.p_plantilla);
    if(q.name==='tembora_enviar_plantilla'&&q.role==='vendedor'&&p?.vendedor_id===sellerId&&(p.estado==='rechazada'||!p.enviada_revision_at)){
     sends++;Object.assign(p,{estado:'pendiente',enviada_revision_at:new Date().toISOString(),revisada_at:null,motivo_rechazo:null});data=p.id;
    }else if(q.name==='tembora_revisar_plantilla'&&q.role==='admin'&&p?.estado==='pendiente'&&p.vendedor_id!==adminId){
     if(q.args.p_estado==='rechazada'&&!q.args.p_motivo?.trim())error={message:'Motivo obligatorio'};
     else {reviews++;const now=new Date().toISOString();Object.assign(p,{estado:q.args.p_estado,motivo_rechazo:q.args.p_motivo,revisada_at:now,updated_at:now});data=p.id;}
    }else error={message:'RPC no permitida en esta prueba'};
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
 const seller=await context('vendedor'),admin=await context('admin'),base='http://127.0.0.1:'+server.address().port+'/';
 const btn=(p,n)=>p.getByRole('button',{name:n,exact:true});
 async function go(p,file){await p.goto(base+file);await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-auth-pending'));}
 await go(seller,'panel-vendedor.html');await seller.getByRole('heading',{name:'Publicada de prueba',exact:true}).waitFor();
 assert.equal(await seller.locator('#seller-nav [aria-current]').innerText(),'Mis plantillas');assert.equal(await seller.locator('.auth-buttons [aria-current]').innerText(),'Mi Panel');
 assert.equal(await seller.locator('.whatsapp-float').count(),0);assert.equal(await btn(seller,'Limpiar archivos antiguos sin uso').count(),0);
 await btn(seller,'Ver información').click();await seller.getByRole('heading',{name:'Detalle de plantilla',exact:true}).waitFor();
 assert.equal(await btn(seller,'Editar / corregir').count(),0);assert.equal(await btn(seller,'Enviar a revisión').count(),0);assert.equal(await seller.getByText(publishedId,{exact:true}).count(),0);
 await btn(seller,'Volver a Mis plantillas').click();await seller.locator('#seller-nav').getByRole('link',{name:'Agregar plantilla'}).click();
 await seller.waitForFunction(()=>!document.getElementById('sell-fields').disabled);
 assert.equal(await seller.getByText('¿Listo para empezar a vender?',{exact:true}).count(),0);
 await seller.locator('#template-name').fill('Nueva para revisión');await seller.locator('#category').selectOption('1');await seller.locator('#price').fill('80');await seller.locator('#technologies').fill('HTML, CSS');await seller.locator('#description').fill(baseTemplate.descripcion);
 await seller.locator('#main-image').setInputFiles(path.join(root,'tests/fixtures/recorrido-vendedor/temporal.png'));await seller.locator('#additional-images').setInputFiles(path.join(root,'tests/fixtures/recorrido-vendedor/comprobante-temporal.png'));await seller.locator('#zip-file').setInputFiles(path.join(root,'tests/fixtures/recorrido-vendedor/temporal.zip'));await seller.locator('#demo-url').fill('https://example.test/demo');
 for(const check of await seller.locator('#sell-form input[type="checkbox"]').all())await check.check();
 await seller.locator('#sell-submit').click();await seller.getByText('Tu plantilla fue enviada correctamente. El administrador la revisará y mientras tanto sus datos y archivos permanecerán bloqueados.',{exact:true}).waitFor();
 assert.equal(sends,1);assert.equal(uploads,3);assert.equal(await seller.locator('#sell-submit').isVisible(),false);assert.equal(await seller.locator('#sell-new').isVisible(),false);assert.equal(await seller.locator('#sell-fields').evaluate(e=>e.disabled),true);
 assert.equal(await seller.locator('#sell-badge').innerText(),'Pendiente de revisión');assert.ok((await seller.locator('#sell-reference').innerText()).length<24);
 await btn(seller,'Comprobar estado').click();assert.equal(sends,1);await seller.getByRole('link',{name:'Volver a Mis plantillas',exact:true}).click();
 let card=seller.locator('.seller-grid article').filter({has:seller.getByRole('heading',{name:'Nueva para revisión',exact:true})});await card.waitFor();assert.equal(await card.getByRole('button',{name:'Editar / corregir'}).count(),0);assert.equal(await card.getByRole('button',{name:'Retirar plantilla'}).count(),0);
 await go(admin,'admin.html');await btn(admin,'Revisar plantilla').click();await admin.getByText('Vendedor: Ana Vendedora',{exact:true}).waitFor();await admin.locator('.seller-thumbnails button').nth(1).waitFor();assert.equal(await admin.locator('.seller-thumbnails button').count(),2);
 const downloaded=admin.waitForEvent('download');await btn(admin,'Descargar ZIP para revisión').click();await downloaded;assert.ok(downloads>0);
 await btn(admin,'Rechazar').click();assert.equal(reviews,0);await admin.getByLabel('Motivo del rechazo',{exact:true}).fill('Mejora la descripción');await btn(admin,'Rechazar').click();await admin.getByText('Plantilla rechazada. El vendedor puede corregirla.',{exact:true}).waitFor();assert.equal(await btn(admin,'Revisar plantilla').count(),0);
 await seller.reload();await card.waitFor();assert.match(await card.locator('.seller-rejection').innerText(),/Motivo de rechazo\s+Mejora la descripción/);assert.equal(await card.getByRole('button',{name:'Enviar a revisión',exact:true}).count(),0);
 await card.getByRole('button',{name:'Editar / corregir'}).click();await seller.getByRole('heading',{name:'Corregir plantilla',exact:true}).waitFor();await seller.locator('#edit-descripcion').fill(baseTemplate.descripcion+' Ahora incluye instrucciones.');
 const uploadedBefore=uploads;await btn(seller,'Guardar corrección').click();await seller.getByText('Corrección guardada. Puedes enviarla a revisión.',{exact:true}).waitFor();assert.equal(sends,1);assert.equal(uploads,uploadedBefore);
 await card.getByRole('button',{name:'Enviar a revisión',exact:true}).click();await seller.getByText('Enviada: pendiente de revisión.',{exact:true}).waitFor();assert.equal(sends,2);assert.match(dialogs.at(-1),/hasta que el administrador la apruebe o rechace/);assert.equal(await card.getByRole('button',{name:'Editar / corregir'}).count(),0);
 await seller.locator('#seller-nav').getByRole('link',{name:'Ventas y retiros'}).click();await seller.getByRole('heading',{name:'Ventas, ganancias y retiros',exact:true}).waitFor();
 assert.deepEqual(await seller.locator('.seller-summary span').allTextContents(),['Ganado','Reservado','Pagado','Disponible']);assert.equal(await seller.locator('#edit-retiro-monto').inputValue(),'39.20');assert.equal(await seller.locator('#edit-retiro-monto').evaluate(e=>e.readOnly),true);
 assert.equal(await seller.locator('#edit-retiro-numero').isDisabled(),true);assert.equal(await seller.locator('#edit-retiro-titular').isDisabled(),true);assert.equal(await btn(seller,'Solicitar retiro').isDisabled(),true);assert.match(await seller.locator('#market-content').innerText(),/10[.,]80/);
 await btn(seller,'Historial de retiros').click();await seller.getByRole('heading',{name:'Historial de retiros',exact:true}).waitFor();await seller.getByText('Aún no tienes retiros registrados.',{exact:true}).waitFor();await btn(seller,'Volver a Ventas y retiros').click();
 await seller.locator('#seller-nav').getByRole('link',{name:'Mi perfil'}).click();await seller.getByLabel('Correo',{exact:true}).waitFor();assert.equal(await seller.getByLabel('Correo',{exact:true}).evaluate(e=>e.readOnly),true);
 await seller.getByLabel('Biografía',{exact:true}).fill('Diseño y desarrollo web');await btn(seller,'Guardar cambios').click();await seller.getByText('Perfil guardado.',{exact:true}).waitFor();assert.equal(db.perfiles[0].rol,'vendedor');assert.equal(db.perfiles[0].bio,'Diseño y desarrollo web');
 // Aprobación únicamente de la plantilla simulada, sin pedido ni pago.
 await admin.reload();await btn(admin,'Revisar plantilla').click();await btn(admin,'Aprobar y publicar').click();await admin.getByText('Plantilla publicada.',{exact:true}).waitFor();assert.equal(await btn(admin,'Revisar plantilla').count(),0);
 await go(seller,'panel-vendedor.html');await card.waitFor();assert.equal(await card.getByRole('button',{name:'Editar / corregir'}).count(),0);assert.equal(await card.locator('.seller-badge').innerText(),'Publicada');
 await go(seller,'catalogo.html');await seller.getByRole('heading',{name:'Nueva para revisión',exact:true}).waitFor();
 await go(seller,'vender.html');await seller.getByText('Tu plantilla está publicada. Sus datos y archivos permanecen bloqueados.',{exact:true}).waitFor();assert.equal(await seller.locator('#sell-submit').isVisible(),false);
 const out=path.join(process.env.TEMP,'taviku-vendedor-revision');fs.mkdirSync(out,{recursive:true});
 for(const width of [1365,390]){await seller.setViewportSize({width,height:900});await go(seller,'panel-vendedor.html');await card.waitFor();assert.ok(await seller.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await seller.screenshot({path:path.join(out,'vendedor-'+width+'.png'),fullPage:true});}
 await seller.locator('#seller-nav').getByRole('link',{name:'Agregar plantilla'}).click();await seller.waitForFunction(()=>!document.getElementById('sell-fields').disabled);assert.equal(await seller.locator('#sell-submit').isVisible(),true);assert.equal(sends,2);
 assert.equal(reviews,2);assert.equal(sends,2);assert.deepEqual(errors,[]);
});
