const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const git=args=>execFileSync('git',args,{encoding:'utf8'});
const normalized=text=>text.replaceAll('\r\n','\n');
const baseline=file=>normalized(git(['show','683ba04:'+file]));

test('bloque comprador conserva rediseño público, servicios, sesión, APIs y RLS',()=>{
 const files=['index.html','catalogo.html','pagina-personalizada.html','webs-completas.html','como-funciona.html','vender-publico.html','contacto.html','login.html','registro.html','css/pillars.css','css/public.css','js/business.js','js/supabase.js','js/auth-oauth.js','js/mercado-api.js','js/pagos-api.js','js/plantillas-envio.js'];
 files.push(...git(['ls-tree','-r','--name-only','683ba04','supabase']).trim().split('\n').filter(Boolean));
 for(const file of files)assert.equal(normalized(fs.readFileSync(file,'utf8')),baseline(file),file+' debe permanecer intacto');
 for(const file of ['admin.html','compra.html','panel-comprador.html','plantilla.html']){
  const current=normalized(fs.readFileSync(file,'utf8')),before=baseline(file);
  for(const regex of [/<nav class="nav-menu"[^>]*>[\s\S]*?<\/nav>/,/<footer class="footer">[\s\S]*?<\/footer>/])if(file!=='admin.html'||regex.source.startsWith('<footer'))assert.equal(current.match(regex)[0],before.match(regex)[0],file+' conserva navegación y footer');
 }
 const admin=normalized(fs.readFileSync('admin.html','utf8'));
 const gallery=html=>html.slice(html.indexOf('    <section id="webs-admin"'),html.indexOf('    <!-- Footer -->'));
 assert.equal(gallery(admin),gallery(baseline('admin.html')),'Webs completas en Admin permanece intacta');
});
