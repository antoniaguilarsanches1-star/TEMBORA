const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const factory=require('../js/mercado-api.js');
const uid='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const pid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const data=()=>({nombre:'Nueva',descripcion:'a'.repeat(100),precio:'20',categoria_id:'1',tecnologias:'HTML, CSS',demo_url:''});
function setup(role='vendedor') {
 const tables={plantillas:[{id:pid,vendedor_id:uid,...data(),tecnologias:['HTML','CSS'],estado:'pendiente',enviada_revision_at:null}],categorias:[{id:1,nombre:'Web'}],imagenes_plantilla:[],favoritos:[],pedidos:[],perfiles:[{id:uid,nombre_completo:'TEMP',rol:role}]};
 const trace=[],failures=new Set(); let active=uid, currentRole=role;
 class Query {
  constructor(table){this.table=table;this.filters=[];this.op='select';this.start=0;this.end=999;}
  select(fields){this.fields=fields;return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  not(k,operator,v){this.filters.push(r=>r[k]!==v);return this;}
  in(k,values){this.filters.push(r=>values.includes(r[k]));return this;}
  order(){return this;}
  range(a,b){this.start=a;this.end=b;return this;}
  insert(value){this.op='insert';this.value=value;return this;}
  update(value){this.op='update';this.value=value;return this;}
  delete(){this.op='delete';return this;}
  single(){return this.run(true);}
  maybeSingle(){return this.run(true);}
  then(a,b){return this.run(false).then(a,b);}
  async run(single) {
   trace.push({table:this.table,op:this.op,fields:this.fields,value:this.value});
   if(failures.has(this.table+'.'+this.op))return {error:{message:'failure'},data:null};
   const all=tables[this.table], found=all.filter(r=>this.filters.every(f=>f(r))).slice(this.start,this.end+1);
   if(this.op==='insert')all.push(...(Array.isArray(this.value)?this.value:[this.value]));
   if(this.op==='update')found.forEach(r=>Object.assign(r,this.value));
   if(this.op==='delete')tables[this.table]=all.filter(r=>!found.includes(r));
   return {data:single?found[0] || null:found,error:null};
  }
 }
 const objects={'imagenes-plantillas':[],'plantillas-zip':[]};
 const client={from:t=>new Query(t),storage:{from:bucket=>({
  download:async path=>{trace.push({download:bucket,path});return {data:new Blob(['file'])};},
  upload:async(path,file,opts)=>{trace.push({upload:bucket,path,opts});if(failures.has('upload'))return {error:{message:'lost upload'}};objects[bucket].push({name:path.split('/').pop()});return {data:{path}};},
  list:async()=>({data:objects[bucket]}),
  remove:async paths=>{trace.push({remove:bucket,paths});objects[bucket]=[];return {data:[]};}
 })},rpc:async(name,args)=> {
  trace.push({rpc:name,args}); if(failures.has('rpc'))return {error:{message:'lost response'}};
  if(name==='tembora_admin_cambiar_rol'){tables.perfiles.find(p=>p.id===args.p_usuario_id).rol=args.p_nuevo_rol;return {data:null};}
  const row=tables.plantillas.find(p=>p.id===args.p_plantilla);
  if(name==='tembora_enviar_plantilla'){row.estado='pendiente';row.enviada_revision_at=new Date().toISOString();}
  else row.estado=args.p_estado;
  return {data:null};
 }};
 const service=factory({cliente:()=>client,sesion:async()=>({success:!!active,user:{id:active},rol:currentRole}),
  uuid:()=>pid, validar:async()=>({principal:{ext:'png',mime:'image/png',file:new Blob(['a'])},zip:new Blob(['zip']),galeria:[]})});
 return {service,tables,trace,failures,objects,role:v=>currentRole=v,account:v=>active=v};
}
test('catálogo solo publicadas para cualquier rol; no selecciona ruta ZIP',async()=>{
 const f=setup('admin');f.tables.plantillas.push({...f.tables.plantillas[0],id:other,estado:'publicada'});
 const rows=await f.service.publicadas();assert.equal(rows.length,1);assert.equal(rows[0].id,other);
 assert.ok(f.trace.every(t=>!t.fields?.includes('archivo_zip_path')));
 assert.equal(await f.service.detalle(pid),null);
});
test('catálogo recorre páginas para no truncar en límite REST',async()=>{
 const f=setup();f.tables.plantillas=Array.from({length:201},(_,i)=>({id:String(i),estado:'publicada'}));
 assert.equal((await f.service.publicadas()).length,201);
});
test('mis plantillas filtra propietario de la sesión',async()=>{
 const f=setup();f.tables.plantillas.push({...f.tables.plantillas[0],vendedor_id:other});
 assert.equal((await f.service.propias()).length,1);
});
for(const role of ['comprador','admin'])test('mis plantillas rechaza '+role,async()=>{
 const f=setup(role);await assert.rejects(()=>f.service.propias());assert.equal(f.trace.length,0);
});
test('cola admin excluye preparaciones y publicaciones',async()=>{
 const f=setup('admin');f.tables.plantillas.push({...f.tables.plantillas[0],id:other,enviada_revision_at:'2026-09-16T00:00:00Z'});
 assert.equal((await f.service.pendientes()).length,1);
});
for(const role of ['comprador','vendedor'])test('revisión y ZIP administrativo rechazan '+role,async()=>{
 const f=setup(role);await assert.rejects(()=>f.service.revisar(pid,'publicada'));await assert.rejects(()=>f.service.zipRevision(pid));assert.equal(f.trace.length,0);
});
test('rechazo requiere motivo antes del RPC',async()=>{
 const f=setup('admin');await assert.rejects(()=>f.service.revisar(pid,'rechazada',' '));assert.equal(f.trace.length,0);
});
test('aprobar/rechazar usa RPC seguro, verifica resultado y no update directo',async()=>{
 const f=setup('admin');await f.service.revisar(pid,'rechazada',' Corregir imagen ');
 assert.equal(f.trace[0].rpc,'tembora_revisar_plantilla');assert.equal(f.trace[0].args.p_motivo,'Corregir imagen');
 assert.ok(!f.trace.some(t=>t.op==='update'));
});
test('fallo RPC no se presenta como éxito',async()=>{
 const f=setup('admin');f.failures.add('rpc');await assert.rejects(()=>f.service.revisar(pid,'publicada'));
});
test('ZIP de revisión usa descarga autenticada sin URL pública',async()=>{
 const f=setup('admin');f.tables.plantillas[0].archivo_zip_path=uid+'/'+pid+'/plantilla.zip';
 assert.ok(await f.service.zipRevision(pid) instanceof Blob);assert.equal(f.trace.at(-1).download,'plantillas-zip');
});
test('edición usa whitelist y conserva estado/propietario',async()=>{
 const f=setup();await f.service.guardar(pid,{...data(),vendedor_id:other,estado:'publicada'});
 const change=f.trace.find(t=>t.op==='update').value;assert.ok(!('vendedor_id' in change));assert.ok(!('estado' in change));
 assert.equal(f.tables.plantillas[0].estado,'pendiente');
});
for(const state of ['publicada','pendiente'])test('edición bloqueada para '+state+' enviada',async()=>{
 const f=setup();Object.assign(f.tables.plantillas[0],{estado:state,enviada_revision_at:'2026-09-16'});
 await assert.rejects(()=>f.service.guardar(pid,data()));assert.ok(!f.trace.some(t=>t.op==='update'));
});
test('no permite editar plantilla ajena',async()=>{
 const f=setup();f.tables.plantillas[0].vendedor_id=other;await assert.rejects(()=>f.service.guardar(pid,data()));
});
test('rechazada se puede corregir y reenviar sin publicar',async()=>{
 const f=setup();f.tables.plantillas[0].estado='rechazada';await f.service.guardar(pid,data());
 const row=await f.service.enviar(pid);assert.equal(row.estado,'pendiente');assert.ok(row.enviada_revision_at);
 assert.equal(f.trace.find(t=>t.rpc).rpc,'tembora_enviar_plantilla');
});
test('galería parcial duplicada tras fallo impide enviar hasta corregirla',async()=>{
 const f=setup();f.tables.imagenes_plantilla=Array.from({length:6},(_,i)=>({id:String(i),plantilla_id:pid,url:'x'+i,orden:i}));
 await assert.rejects(()=>f.service.enviar(pid),/más de cinco/);assert.ok(!f.trace.some(t=>t.rpc));
});
test('subida fallida de corrección no borra archivos anteriores ni envía',async()=>{
 const f=setup();f.failures.add('upload');await assert.rejects(()=>f.service.guardar(pid,data(),{archivoZip:{}}));
 assert.ok(!f.trace.some(t=>t.remove || t.rpc || t.op==='delete'));
});
test('reemplazo usa nombres nuevos y upsert false',async()=>{
 const f=setup();await f.service.guardar(pid,data(),{archivoZip:{}});
 const uploads=f.trace.filter(t=>t.upload);assert.equal(uploads.length,2);
 assert.ok(uploads.every(t=>t.path.startsWith(uid+'/'+pid+'/') && t.opts.upsert===false));
 assert.ok(!f.trace.some(t=>t.remove));
});
test('retirada elimina archivos propios antes de eliminar registro',async()=>{
 const f=setup();f.objects['plantillas-zip'].push({name:'plantilla.zip'});await f.service.retirar(pid);
 assert.ok(f.trace.findIndex(t=>t.remove)<f.trace.findIndex(t=>t.op==='delete'));
});
test('retirada rechaza nombres fuera del patrón antes de borrar',async()=>{
 const f=setup();f.objects['imagenes-plantillas'].push({name:'../otro.png'});await assert.rejects(()=>f.service.retirar(pid));assert.ok(!f.trace.some(t=>t.remove));
});
test('favoritos usan usuario verificado y solo plantillas publicadas',async()=>{
 const f=setup('comprador');await assert.rejects(()=>f.service.favorito(pid,true));
 f.tables.plantillas[0].estado='publicada';await f.service.favorito(pid,true);await f.service.favorito(pid,true);
 assert.equal(f.tables.favoritos.length,1);assert.equal(f.tables.favoritos[0].usuario_id,uid);
 await f.service.favorito(pid,false);assert.equal(f.tables.favoritos.length,0);
});
test('pedidos se leen para el comprador actual, no se verifican en frontend',async()=>{
 const f=setup('comprador');f.tables.pedidos=[{comprador_id:uid},{comprador_id:other}];assert.equal((await f.service.pedidos()).length,1);
 assert.ok(f.trace.every(t=>t.op==='select'));
});
test('consulta fallida se propaga sin convertirla en lista vacía',async()=>{
 const f=setup();f.failures.add('plantillas.select');await assert.rejects(()=>f.service.publicadas());
});
for(const [key,value] of [['descripcion','corta'],['precio','19'],['precio','20.001'],['categoria_id','999'],['demo_url','javascript:alert(1)']])test('edición valida '+key+'='+value,async()=>{
 const f=setup();await assert.rejects(()=>f.service.guardar(pid,{...data(),[key]:value}));assert.ok(!f.trace.some(t=>t.op==='update'));
});
test('HTML conserva guard previo y carga API después de supabase',()=>{
 for(const file of ['panel-vendedor.html','panel-comprador.html','admin.html']) {
  const html=fs.readFileSync(file,'utf8');assert.match(html,/<html[^>]*data-auth-pending/);assert.match(html,/html\[data-auth-pending\] body/);
  assert.ok(html.indexOf('js/supabase.js')<html.indexOf('js/mercado-api.js'));assert.match(html,/id="market-status"/);
 }
});
test('render del marketplace no usa innerHTML ni handlers interpolados',()=>{
 const code=fs.readFileSync('js/mercado-ui.js','utf8');assert.ok(!code.includes('innerHTML'));assert.ok(!code.includes('getPublicUrl'));
});
test('usuarios: solo administrador lista perfiles y no selecciona credenciales',async()=>{
 const f=setup('admin');assert.equal((await f.service.usuarios()).length,1);assert.equal(f.trace[0].fields,'id,nombre_completo,rol,created_at');
 f.role('comprador');await assert.rejects(()=>f.service.usuarios());
});
test('usuarios: cambio de rol usa RPC existente, impide autoasignación',async()=>{
 const f=setup('admin');f.tables.perfiles.push({id:other,rol:'comprador'});await assert.rejects(()=>f.service.cambiarRol(uid,'admin'));
 await f.service.cambiarRol(other,'vendedor');assert.equal(f.trace[0].rpc,'tembora_admin_cambiar_rol');
 assert.equal(f.tables.perfiles[1].rol,'vendedor');
});
test('perfil: editar no admite rol ni id proporcionado por cliente',async()=>{
 const f=setup('comprador');await f.service.miPerfil({nombre_completo:'Nuevo',bio:'Texto',rol:'admin',id:other});
 assert.deepEqual(f.trace.find(x=>x.op==='update').value,{nombre_completo:'Nuevo',bio:'Texto'});
 assert.equal(f.tables.perfiles[0].rol,'comprador');
});
test('compra y vendedor públicos no tienen pantallas de demostración',()=>{
 const purchase=fs.readFileSync('compra.html','utf8'),seller=fs.readFileSync('vendedor.html','utf8');
 assert.match(purchase,/data-auth-pending/);assert.match(purchase,/data-market="compra"/);assert.match(seller,/data-market="vendedor-publico"/);
 assert.ok(!purchase.includes('confirm-payment'));assert.ok(!seller.includes('CarlosWeb'));
 assert.match(fs.readFileSync('js/supabase.js','utf8'),/'compra.html': \['comprador'\]/);
});
