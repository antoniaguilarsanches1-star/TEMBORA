const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

test('regresión final de la parte pública',async t=>{
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
  const user={id:'seller',app_metadata:{provider:'google'}};
  const role=()=>localStorage.getItem('test-role');
  const session=()=>role()?{user,access_token:'fixture-token'}:null;
  const categories=[{id:1,nombre:'Restaurantes'},{id:2,nombre:'Landing Pages'}];
  const templates=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',nombre:'Restaurante de prueba',descripcion:'Plantilla pública de prueba',precio:79,categoria_id:1,estado:'publicada',imagen_principal:'image.png',vendedor_id:'seller',tecnologias:['HTML']}];
  const client={from:table=>{const filters=[];const rows=()=> (table==='categorias'?categories:table==='plantillas'?templates:table==='perfiles'?[{id:'seller',rol:role()}]:[]).filter(r=>filters.every(([k,v])=>r[k]===v));
   const q={select:()=>q,order:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},not:()=>q,range:async()=>({data:rows()}),maybeSingle:async()=>({data:rows()[0]||null}),single:async()=>({data:rows()[0]||null}),then:resolve=>resolve({data:rows()})};return q;},
   storage:{from:()=>({download:async()=>({data:new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],{type:'image/png'})})})},
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
  assert.deepEqual(await page.locator('.nav-menu a').allTextContents(),['Inicio','Plantillas','Cómo funciona','Vender','Creamos tu página','Contacto']);
  if(current)assert.equal(await page.locator('.header [aria-current="page"]').getAttribute('href'),current+'.html');
  const links=await page.locator('.footer a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  for(const href of links){if(href.startsWith('https:')){assert.ok(href.startsWith('https://wa.me/'));continue;}assert.ok(fs.existsSync(path.join(root,href)),href);}
 }
 await check('Inicio: tarjetas, categorías, hero y navbar',async()=>{
  await go('index.html');await shell('index');
  await page.locator('.public-template img').waitFor();
  assert.equal(await page.locator('.public-template').count(),1);
  assert.deepEqual(await page.locator('.public-template').evaluate(e=>[...e.children].map(x=>x.className)),['template-image','template-content']);
  assert.equal(await page.locator('.public-template .template-category').innerText(),'Restaurantes');
  await page.getByText('Ver todas las plantillas',{exact:true}).waitFor();
  await page.locator('a[href="catalogo.html?category=restaurantes"]').click();
  await page.waitForFunction(()=>document.getElementById('category-filter').value==='1');
  await shell('catalogo');
 });
 await check('Plantillas: filtros, limpieza y tarjeta clicable',async()=>{
  await page.locator('#search-catalog').fill('No existe');await page.locator('#apply-filters').click();
  await page.getByText('No hay plantillas publicadas que coincidan con tu búsqueda.').waitFor();
  await page.locator('#clear-filters').click();await page.locator('.public-template').waitFor();
  assert.equal(await page.locator('#category-filter').inputValue(),'');
  await page.locator('.public-template').click({position:{x:20,y:20}});await page.waitForURL('**/plantilla.html?id=*');
 });
 async function faq(file,count){
  await go(file+'.html');await shell(file);
  const questions=page.locator('.faq-question');assert.equal(await questions.count(),count);
  await questions.nth(0).click();assert.equal(await questions.nth(0).getAttribute('aria-expanded'),'true');
  await questions.nth(1).focus();await page.keyboard.press('Enter');
  assert.equal(await questions.nth(0).getAttribute('aria-expanded'),'false');assert.equal(await questions.nth(1).getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('.faq-answer:visible').count(),1);
  await page.keyboard.press('Space');assert.equal(await page.locator('.faq-answer:visible').count(),0);
 }
 await check('Cómo funciona: seis FAQ accesibles',()=>faq('como-funciona',6));
 await check('Vender: visitante, comprador, administrador y vendedor',async()=>{
  await go('vender-publico.html');await shell('vender-publico');
  await page.getByText('Crear cuenta de vendedor',{exact:true}).waitFor();
  for(const role of ['comprador','admin']){
   await page.evaluate(r=>localStorage.setItem('test-role',r),role);await go('vender-publico.html');
   assert.ok(page.url().endsWith('vender-publico.html'));await page.getByRole('button',{name:'Ir a mi panel',exact:true}).waitFor();
   assert.match(await page.locator('#seller-session').innerText(),/no cambia tu rol/);
  }
  await page.evaluate(()=>localStorage.setItem('test-role','vendedor'));await page.goto(base+'vender-publico.html');await page.waitForURL('**/panel-vendedor.html');
  await page.evaluate(()=>localStorage.removeItem('test-role'));
 });
 await check('Creamos tu página: selección, WhatsApp, fecha futura y mensaje',async()=>{
  await go('pagina-personalizada.html');await shell('pagina-personalizada');
  await page.locator('[data-service="Educación"]').click();assert.equal(await page.locator('#page-type').inputValue(),'Educación');
  await page.locator('#name').fill('Ana Pérez');await page.locator('#business-type').selectOption('Educación');await page.locator('#sections').selectOption('4-6');
  await page.locator('#budget').selectOption('500-1000');await page.locator('#description').fill('Sitio para clases');
  await page.locator('#whatsapp').fill('12345678a');assert.equal(await page.locator('#whatsapp').evaluate(e=>e.checkValidity()),false);
  await page.locator('#whatsapp').fill('123456789');await page.locator('#deadline').fill('2000-01-01');assert.equal(await page.locator('#deadline').evaluate(e=>e.checkValidity()),false);
  await page.locator('#deadline').fill('2099-01-01');await page.locator('#needs-reservation').check();await page.locator('#needs-payment').check();
  await page.locator('#custom-page-form button[type="submit"]').click();await page.waitForFunction(()=>window.testWhatsApp);
  const message=await page.evaluate(()=>new URL(window.testWhatsApp).searchParams.get('text'));
  for(const text of ['Nombre: Ana Pérez','Tipo de negocio: Educación','Tipo de página: Educación','Cantidad de secciones: 4-6','sistema de reservaciones','pasarela de pagos','no es precio final','Fecha deseada: 2099-01-01','Descripción: Sitio para clases'])assert.ok(message.includes(text),text);
 });
 await check('Contacto: FAQ, validaciones y mensaje ordenado',async()=>{
  await faq('contacto',4);
  await page.locator('#name').fill('Ana123');assert.equal(await page.locator('#name').evaluate(e=>e.checkValidity()),false);
  await page.locator('#name').fill('Ana Pérez');await page.locator('#email').fill('invalido');assert.equal(await page.locator('#email').evaluate(e=>e.checkValidity()),false);
  await page.locator('#email').fill('ana@example.test');await page.locator('#subject').selectOption('Retiro de ganancias');await page.locator('#message').fill('Consulta de prueba');
  await page.locator('#contact-form button[type="submit"]').click();await page.waitForFunction(()=>window.testWhatsApp);
  const message=await page.evaluate(()=>new URL(window.testWhatsApp).searchParams.get('text'));assert.equal(message,'Nombre: Ana Pérez\nCorreo: ana@example.test\nAsunto: Retiro de ganancias\nMensaje: Consulta de prueba');
  assert.equal(await page.getByText('Lima, Perú',{exact:true}).count(),0);
 });
 await check('Login y registro: presentación, bloqueo inicial y Google sin acceso real',async()=>{
  for(const file of ['login','registro']){
   await go(file+'.html');await shell(file);assert.equal(await page.locator('.whatsapp-float').count(),0);
   assert.equal(await page.locator('input[type="checkbox"]').first().evaluate(e=>e.getBoundingClientRect().width<30),true);
   await page.locator('#password').fill('Prueba12345');await page.locator('.password-toggle').first().click();assert.equal(await page.locator('#password').getAttribute('type'),'text');
   if(file==='registro'){await page.locator('#register-form input[type="checkbox"]').nth(0).check();await page.locator('#register-form input[type="checkbox"]').nth(1).check();assert.equal(await page.locator('.choice-label a').count(),2);}
   await page.locator('[data-oauth-provider="google"]').click();await page.waitForFunction(()=>window.testOAuth);assert.equal(await page.evaluate(()=>window.testOAuth.provider),'google');
  }
  await go('registro.html?tipo=vendedor');assert.equal(await page.locator('input[value="seller"]').isChecked(),true);
 });
 await check('Responsive básico y footer en todas las páginas públicas',async()=>{
  const files=['index','catalogo','como-funciona','vender-publico','pagina-personalizada','contacto','login','registro','terminos','privacidad','licencias','vendedor'];
  await page.setViewportSize({width:390,height:844});
  for(const file of files){await go(file+'.html');await shell(['terminos','privacidad','licencias'].includes(file)?null:file==='vendedor'?'catalogo':file);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Desbordamiento en '+file);
  }
  await page.locator('.hamburger').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.nav-menu').isVisible(),true);
 });
 assert.deepEqual(errors,[]);
});
