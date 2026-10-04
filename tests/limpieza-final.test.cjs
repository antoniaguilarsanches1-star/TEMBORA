const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pages=fs.readdirSync(root).filter(file=>file.endsWith('.html'));

test('navegación y footer coherentes; recursos y enlaces locales existentes',()=>{
 const home=read('index.html');
 const nav=/<nav class="nav-menu"[^>]*>[\s\S]*?<\/nav>/;
 const footer=/<footer class="footer">[\s\S]*?<\/footer>/;
 for(const file of pages){
  const html=read(file);
  if(nav.test(html))assert.equal(html.match(nav)[0],home.match(nav)[0],file);
  if(footer.test(html))assert.equal(html.match(footer)[0].replace(/\s+/g,' '),home.match(footer)[0].replace(/\s+/g,' '),file);
  assert.ok(!html.includes('Creamos tu página'),file);
  for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(/^(https?:|mailto:|tel:|data:|javascript:)/.test(url))continue;
   const [pathname,fragment]=url.split('#');
   const target=pathname.split('?')[0]||file;
   assert.ok(fs.existsSync(path.join(root,target)),`${file}: ${url}`);
   // Recuperación se crea al cargar el módulo de autenticación existente.
   if(fragment&&target.endsWith('.html')&&!(file==='login.html'&&url==='#recover-password-form'))assert.ok(read(target).includes(`id="${fragment}"`),`${file}: ${url}`);
  }
 }
});

test('sitemap público y vistas privadas sin indexación ni WhatsApp flotante',()=>{
 const urls=[...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname.replace('/TEMBORA/','')||'index.html');
 assert.deepEqual(new Set(urls),new Set(['index.html','catalogo.html','pagina-personalizada.html','webs-completas.html','como-funciona.html','vender-publico.html','contacto.html','terminos.html','privacidad.html','licencias.html']));
 for(const file of ['admin.html','panel-comprador.html','panel-vendedor.html','compra.html','vender.html']){
  const html=read(file);
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/,file);
  assert.ok(!html.includes('whatsapp-float'),file);
 }
 const subjects=[...read('contacto.html').match(/<select id="subject"[\s\S]*?<\/select>/)[0].matchAll(/<option>(.*?)<\/option>/g)].map(m=>m[1]);
 assert.deepEqual(subjects,['Consulta sobre una plantilla','Problema con una compra','Quiero vender plantillas','Quiero una página para mi negocio','Web completa','Soporte','Otra consulta']);
});
