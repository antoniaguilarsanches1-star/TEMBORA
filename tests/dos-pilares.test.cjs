const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

test('dos pilares y gestión de webs completas',async t=>{
 const check=(name,run)=>process.env.PUBLIC_CASE && !name.startsWith(process.env.PUBLIC_CASE)?Promise.resolve():t.test(name,run);
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
 const context=await browser.newContext({viewport:{width:1365,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{window.open=(url)=>{window.testWhatsApp=url;return null;};});
 const sdk=`(() => {
  const user={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',app_metadata:{provider:'google'}};
  const role=()=>localStorage.getItem('test-role');
  const session=()=>role()?{user,access_token:'fixture-token'}:null;
  const categories=[{id:1,nombre:'Restaurantes'},{id:2,nombre:'Landing Pages'}];
  const templates=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',nombre:'Restaurante de prueba',descripcion:'Plantilla pública de prueba',precio:79,categoria_id:1,estado:'publicada',imagen_principal:'image.png',vendedor_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',tecnologias:['HTML']}];
  const models=[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',nombre:'Barbería modelo',tipo_negocio:'Barbería',descripcion:'Modelo con reservas',funciones:['Reservas','QR'],portada:'cover.png',demo_url:'https://example.com/barberia',estado:'publicada',posicion:0},{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',nombre:'Modelo oculto',tipo_negocio:'Tienda',descripcion:'Oculto',funciones:[],estado:'oculta',posicion:1}];
  const client={from:table=>{const filters=[];let write=null;const rows=()=> (table==='webs_completas'?models:table==='categorias'?categories:table==='plantillas'?templates:table==='perfiles'?[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',rol:role()||'vendedor',nombre_completo:'Vendedor de prueba'}]:[]).filter(r=>filters.every(([k,v])=>r[k]===v));
   const q={insert:r=>{write=()=>{const model={id:crypto.randomUUID(),...r};models.push(model);return model;};return q;},update:r=>{write=()=>{const model=rows()[0];Object.assign(model,r);return model;};return q;},select:()=>q,order:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},not:()=>q,range:async()=>({data:rows()}),maybeSingle:async()=>({data:rows()[0]||null}),single:async()=>({data:write?write():rows()[0]||null}),then:resolve=>resolve({data:rows()})};return q;},
   storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}}),upload:async()=>({data:{path:'cover.png'}}),remove:async()=>({data:[]}),download:async()=>({data:new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],{type:'image/png'})})})},
   auth:{getSession:async()=>{await new Promise(r=>setTimeout(r,100));return {data:{session:session()}};},getUser:async()=>({data:{user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithOAuth:async args=>{window.testOAuth=args;return {error:null};}}};
  window.supabase={createClient:()=>client};
 })();`;
 await context.route('https://**/*',async route=>{
  const url=route.request().url();
  if(url.includes('font-awesome'))return route.fulfill({contentType:'text/css',body:'.fas,.fab { display:inline-block; width:1em; height:1em; }'});
  if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:sdk});
  if(url.endsWith('/auth/v1/settings')){await new Promise(r=>setTimeout(r,120));return route.fulfill({json:{external:{google:true}}});}
  return route.fulfill({body:''});
 });
 const base=`http://127.0.0.1:${server.address().port}/`;
 const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.sessionState!=='loading'&&!document.documentElement.hasAttribute('data-auth-form-pending')&&!document.documentElement.hasAttribute('data-register-layout-pending'));
 async function go(file){await page.goto(base+file);await ready();}
 async function shell(current){
  assert.deepEqual(await page.locator('.nav-menu a').allTextContents(),['Inicio','Plantillas','Para negocios','Webs completas','Cómo funciona','Vender','Contacto']);
  if(current)assert.equal(await page.locator('.header [aria-current="page"]').getAttribute('href'),current+'.html');
  const links=await page.locator('.footer a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  for(const href of links){if(href.startsWith('https:')){assert.ok(href.startsWith('https://wa.me/'));continue;}assert.ok(fs.existsSync(path.join(root,href.split('?')[0])),href);}
 }

 await check('Inicio: dos acciones equivalentes y buscador en marketplace',async()=>{
  await go('index.html');
  assert.deepEqual(await page.locator('.hero .pillar-actions a').allTextContents(),['Explorar plantillas','Crear mi página']);
  assert.equal(await page.locator('.hero .search-container').count(),0);
  assert.equal(await page.locator('.search-container').count(),1);
  const buttons=await page.locator('.hero .pillar-actions a').evaluateAll(nodes=>nodes.map(n=>n.className));assert.equal(buttons[0],buttons[1]);
 });
 await check('Galería: solo publicadas, demo segura y selección automática',async()=>{
  await go('webs-completas.html');await page.locator('#webs-gallery article').waitFor();
  assert.equal(await page.locator('#webs-gallery article').count(),1);
  assert.equal(await page.getByRole('link',{name:'Ver demo',exact:true}).getAttribute('href'),'https://example.com/barberia');
  assert.equal(await page.getByRole('link',{name:'Ver demo',exact:true}).getAttribute('rel'),'noopener noreferrer');
  await page.getByRole('button',{name:'Quiero una web así'}).click();
  assert.equal(await page.locator('#chosen-model').inputValue(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  assert.equal(await page.locator('#chosen-model').evaluate(e=>document.activeElement===e),true);
  await page.locator('#request-name').fill('Ana');await page.locator('#business-name').fill('Mi barbería');
  await page.locator('#request-phone').fill('993498739');await page.locator('#request-description').fill('Agregar mis fotos');
  await page.locator('#business-request button[type="submit"]').click();await page.waitForFunction(()=>window.testWhatsApp);
  const message=await page.evaluate(()=>new URL(window.testWhatsApp).searchParams.get('text'));
  assert.ok(message.includes('Web elegida: Barbería modelo — Barbería'));assert.ok(message.includes('Cambios o adicionales: Agregar mis fotos'));
 });
 await check('Admin: editar, ocultar, publicar, ordenar y crear con portada',async()=>{
  await go('index.html');
  await page.evaluate(()=>localStorage.setItem('test-role','admin'));await go('admin.html');
  await page.locator('#webs-admin-list article').first().waitFor();
  await page.locator('#webs-admin-list article').first().getByRole('button',{name:'Editar modelo'}).click();
  await page.locator('#web-state').selectOption('oculta');await page.locator('#web-order').fill('4');
  await page.getByRole('button',{name:'Guardar modelo',exact:true}).click();
  await page.getByText('Barbería · oculta · Posición 4',{exact:true}).waitFor();
  await page.locator('#webs-admin-list article').first().getByRole('button',{name:'Editar modelo'}).click();
  await page.locator('#web-state').selectOption('publicada');await page.getByRole('button',{name:'Guardar modelo',exact:true}).click();
  await page.getByText('Barbería · publicada · Posición 4',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Nueva web completa',exact:true}).click();
  await page.locator('#web-name').fill('Restaurante nuevo');await page.locator('#web-type').selectOption('Restaurante');
  await page.locator('#web-description').fill('Carta digital con reservas');await page.locator('#web-features').fill('Menú\nReservas');
  await page.locator('#web-demo').fill('https://example.com/restaurante');await page.locator('#web-state').selectOption('publicada');
  await page.getByRole('button',{name:'Guardar modelo',exact:true}).click();await page.getByText('Para publicar agrega una portada, una demo HTTPS y al menos una función.').waitFor();
  await page.locator('#web-cover').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await page.locator('#web-admin-images').setInputFiles({name:'admin.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Guardar modelo',exact:true}).click();await page.locator('#webs-admin-list').getByText('Restaurante nuevo',{exact:true}).waitFor();
  await page.evaluate(()=>localStorage.removeItem('test-role'));
 });
 await check('Recuperación de contraseña conserva formulario y retorno',async()=>{
  await go('login.html');
  await page.evaluate(()=>{supabaseClient.auth.resetPasswordForEmail=async(email,options)=>{window.testRecovery={email,options};return {error:null};};});
  await page.locator('#forgot-password-link').click();await page.locator('#recover-email').fill('ana@example.test');
  await page.locator('#recover-password-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.testRecovery);
  assert.equal(await page.evaluate(()=>window.testRecovery.email),'ana@example.test');
  assert.equal(await page.evaluate(()=>window.testRecovery.options.redirectTo),base+'login.html');
  await page.locator('#back-to-login').click();assert.equal(await page.locator('#login-form').isVisible(),true);
 });
 await check('Responsive y capturas de las siete páginas',async()=>{
  const files=['index','catalogo','pagina-personalizada','webs-completas','como-funciona','vender-publico','contacto'];
  const out=path.join(process.env.TEMP||root,'taviku-pillars-qa');fs.mkdirSync(out,{recursive:true});
  for(const width of [1440,1024,390,320]) {
   await page.setViewportSize({width,height:900});
   for(const file of files){await go(file+'.html');await shell(file);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Desbordamiento '+file+' '+width);
    if(width===1440||width===390)await page.screenshot({path:path.join(out,file+'-'+width+'.png'),fullPage:true});
   }
  }
 });
 assert.deepEqual(errors,[]);
});
