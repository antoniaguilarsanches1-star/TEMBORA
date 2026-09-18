const {test} = require('node:test');
const assert = require('node:assert/strict');
const makeService = require('../js/plantillas-envio.js');
const uid = '11111111-1111-4111-8111-111111111111';
function png() {return new File([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])], 'foto.PNG', {type:'image/png'});}
function zip() {
 const local=Buffer.alloc(31);local.writeUInt32LE(0x04034b50);local[30]=65;
 const cd=Buffer.alloc(47);cd.writeUInt32LE(0x02014b50);cd[46]=65;
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(cd.length,12);end.writeUInt32LE(local.length,16);
 return new File([local,cd,end],'web.zip',{type:'application/x-zip-compressed'});
}
const datos = () => ({nombre:'  Mi plantilla  ',descripcion:'A'.repeat(100),precio:'20.50',tecnologias:'HTML, CSS',categoria_id:'1',demo_url:'https://example.com/demo'});
const files = () => ({imagenPrincipal:png(),imagenesAdicionales:[png()],archivoZip:zip()});
function fixture(options={}) {
 const rows=new Map(),objects=new Map([['imagenes-plantillas',[]],['plantillas-zip',[]]]);
 const gallery=[],trace=[], memory=options.memory || new Map();let serial=0;
 let role=options.role || 'vendedor',account=uid,sessionCalls=0;
 const failures=new Map(Object.entries(options.failures || {}));
 async function operation(key, fn) {
  trace.push(key);
  const fail=failures.get(key);
  if(fail && !fail.after){if(fail.once)failures.delete(key);if(fail.throw)throw Error('offline');return {data:null,error:fail.error};}
  const data=await fn();
  if(fail){if(fail.once)failures.delete(key);return {data:null,error:fail.error || {message:'lost response'}};}
  return {data,error:null};
 }
 class Query {
  constructor(table){this.table=table;this.mode='select';this.filters=[];}
  select(){return this;}
  order(){return this;}
  insert(value){this.mode='insert';this.value=value;return this;}
  update(value){this.mode='update';this.value=value;return this;}
  delete(){this.mode='delete';return this;}
  eq(key,value){this.filters.push([key,value]);return this;}
  is(key,value){return this.eq(key,value);}
  single(){return this.exec(true);}
  maybeSingle(){return this.exec(true);}
  then(resolve,reject){return this.exec(false).then(resolve,reject);}
  async exec(single) {
   return operation(this.table+'.'+this.mode,()=>{
    if(this.table==='categorias')return options.emptyCategories?[]:[{id:1,nombre:'Negocios'}];
    if(this.table==='imagenes_plantilla'){gallery.push(...this.value);return null;}
    if(this.mode==='insert'){const r={...this.value,estado:'pendiente',enviada_revision_at:null};rows.set(r.id,r);return r;}
    const found=[...rows.values()].filter(r=>this.filters.every(([k,v])=>r[k]===v));
    if(this.mode==='update'){for(const r of found)Object.assign(r,this.value);return single?found[0]:found;}
    if(this.mode==='delete'){for(const r of found){rows.delete(r.id);for(let i=gallery.length-1;i>=0;i--)if(gallery[i].plantilla_id===r.id)gallery.splice(i,1);}return found.map(r=>({id:r.id}));}
    return single?found[0]||null:found;
   });
  }
 }
 const client={
  from:table=>new Query(table),
  storage:{from:bucket=>({
   upload:(path,file,opts)=>operation('upload.'+bucket,()=>{
    assert.equal(opts.upsert,false);assert.ok(path.startsWith(uid+'/'));
    if(bucket==='plantillas-zip')assert.equal(opts.contentType,'application/zip');
    objects.get(bucket).push({name:path,file});return {path};
   }),
   list:(prefix,{limit})=>operation('list.'+bucket,()=>objects.get(bucket).filter(o=>o.name.startsWith(prefix+'/')).slice(0,limit).map(o=>({name:o.name.slice(prefix.length+1)}))),
   remove:paths=>operation('remove.'+bucket,()=>{
    assert.ok(Array.isArray(paths));const found=objects.get(bucket).filter(o=>paths.includes(o.name));
    objects.set(bucket,objects.get(bucket).filter(o=>!paths.includes(o.name)));return found;
   })
  })},
  rpc:(name,args)=>operation('rpc',()=>{
   assert.equal(name,'tembora_enviar_plantilla');const r=rows.get(args.p_plantilla);
   assert.ok(r?.archivo_zip_path && r?.imagen_principal);
   r.enviada_revision_at='2026-09-16T00:00:00Z';return null;
  })
 };
 const deps={cliente:()=>client, sesion:async()=>{sessionCalls++;if(options.sessionHook)options.sessionHook(sessionCalls,()=>{account='22222222-2222-4222-8222-222222222222';});
   return {success:!options.noSession,rol:role,user:{id:account}};},
  uuid:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-'+String(++serial).padStart(12,'0'),
  memoria:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(options.storageFails)throw Error('Almacenamiento no disponible');memory.set(k,v);},removeItem:k=>memory.delete(k)},
  locks:options.locks,comprobarImagen:options.decode};
 return {service:makeService(deps),deps,rows,objects,gallery,trace,memory,failures,setRole:r=>role=r};
}
test('éxito: padre primero, rutas privadas, dueño autenticado y RPC al final',async()=>{
 const f=fixture(), progress=[];const r=await f.service.crear({...datos(),vendedor_id:'intruso'},files(),m=>progress.push(m));
 assert.equal(r.success,true);assert.equal(r.plantilla.estado,'pendiente');assert.ok(r.plantilla.enviada_revision_at);
 const row=[...f.rows.values()][0];assert.equal(row.vendedor_id,uid);assert.equal(row.nombre,'Mi plantilla');
 assert.ok(row.archivo_zip_path.endsWith('/plantilla.zip'));assert.ok(!row.imagen_principal.startsWith('http'));
 assert.ok(f.gallery[0].url.endsWith('/galeria-1.png'));assert.ok(progress.length>=6);
 assert.ok(f.trace.indexOf('plantillas.insert')<f.trace.indexOf('upload.imagenes-plantillas'));
 assert.ok(f.trace.indexOf('plantillas.update')<f.trace.indexOf('rpc'));assert.ok(f.trace.indexOf('imagenes_plantilla.insert')<f.trace.indexOf('rpc'));
});
for(const role of ['admin','comprador'])test('rol '+role+' no puede enviar',async()=>{
 const f=fixture({role});assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.trace.length,0);
});
test('sin sesión no escribe',async()=>{const f=fixture({noSession:true});assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.trace.length,0);});
const invalids=[
 ['precio bajo',d=>d.precio='19.99'],['precio infinito',d=>d.precio=Infinity],['tres decimales',d=>d.precio='20.123'],
 ['descripción corta',d=>d.descripcion='x'.repeat(99)],['descripción de espacios',d=>d.descripcion=' '.repeat(110)],
 ['título vacío',d=>d.nombre=' '],['categoría vacía',d=>d.categoria_id=''],
 ['tecnologías vacías',d=>d.tecnologias=' , '],['demo peligrosa',d=>d.demo_url='javascript:alert(1)'],
 ['demo con credenciales',d=>d.demo_url='https://user:pass@example.com'],
 ['categoría inexistente',d=>d.categoria_id='999']
];
for(const [name,change] of invalids)test(name+' se rechaza sin crear',async()=>{
 const f=fixture(),d=datos();change(d);assert.equal((await f.service.crear(d,files())).success,false);assert.ok(!f.trace.includes('plantillas.insert'));
});
const invalidFiles=[
 ['imagen ausente',f=>f.imagenPrincipal=null],
 ['imagen vacía',f=>f.imagenPrincipal=new File([],'x.png',{type:'image/png'})],
 ['imagen grande',f=>f.imagenPrincipal={size:5*1024*1024+1}],
 ['firma falsa',f=>f.imagenPrincipal=new File(['fake'],'foto.png',{type:'image/png'})],
 ['MIME falso',f=>f.imagenPrincipal=new File([Uint8Array.from([137,80,78,71,13,10,26,10])],'foto.png',{type:'image/svg+xml'})],
 ['extensión falsa',f=>f.imagenPrincipal=new File([Uint8Array.from([137,80,78,71,13,10,26,10])],'foto.svg',{type:'image/png'})],
 ['seis adicionales',f=>f.imagenesAdicionales=Array.from({length:6},png)],
 ['adicional inválida',f=>f.imagenesAdicionales=[new File(['bad'],'x.png',{type:'image/png'})]],
 ['ZIP ausente',f=>f.archivoZip=null],
 ['ZIP grande',f=>f.archivoZip={size:50*1024*1024+1,name:'x.zip'}],
 ['ZIP extensión inválida',f=>f.archivoZip=new File(['PK'],'x.exe')],
 ['ZIP falso',f=>f.archivoZip=new File(['fake'],'x.zip',{type:'application/zip'})],
 ['ZIP truncado',f=>f.archivoZip=new File([Uint8Array.from([80,75,3,4])],'x.zip',{type:'application/zip'})]
];
for(const [name,change] of invalidFiles)test(name+' se rechaza sin crear',async()=>{
 const f=fixture(),ff=files();change(ff);assert.equal((await f.service.crear(datos(),ff)).success,false);assert.ok(!f.trace.includes('plantillas.insert'));
});
test('imagen no decodificable se rechaza',async()=>{
 const f=fixture({decode:async()=>{throw Error('corrupta');}});assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.trace.length,0);
});
test('5 MB exactos de imagen y cinco adicionales permitidos',async()=>{
 const ff=files();ff.imagenPrincipal=new File([await png().arrayBuffer(),new Uint8Array(5*1024*1024-12)],'x.png',{type:'image/png'});
 ff.imagenesAdicionales=Array.from({length:5},png);const f=fixture();assert.equal((await f.service.crear(datos(),ff)).success,true);assert.equal(f.gallery.length,5);
});
for(const stage of ['plantillas.insert','upload.imagenes-plantillas','upload.plantillas-zip','plantillas.update','imagenes_plantilla.insert'])
test('fallo definitivo en '+stage+' limpia archivos antes que padre',async()=>{
 const f=fixture({failures:{[stage]:{error:{code:'42501'},once:true}}});
 const r=await f.service.crear(datos(),files());assert.equal(r.success,false);assert.ok(!r.recuperable);
 assert.equal(f.rows.size,0);assert.equal(f.memory.size,0);assert.equal([...f.objects.values()].flat().length,0);assert.ok(!f.trace.includes('rpc'));
 const lastRemove=Math.max(f.trace.lastIndexOf('remove.imagenes-plantillas'),f.trace.lastIndexOf('remove.plantillas-zip'));
 assert.ok(f.trace.lastIndexOf('plantillas.delete')>lastRemove);
});
test('galería falla: nunca éxito parcial',async()=>{
 const f=fixture({failures:{'imagenes_plantilla.insert':{error:{code:'23514'},once:true}}});
 assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.gallery.length,0);assert.equal(f.rows.size,0);
});
test('limpieza incompleta conserva referencia y permite retirar después',async()=>{
 const f=fixture({failures:{'upload.plantillas-zip':{error:{code:'42501'},once:true},'remove.imagenes-plantillas':{error:{status:403},once:true}}});
 const r=await f.service.crear(datos(),files());assert.equal(r.recuperable,true);assert.equal(f.rows.size,1);assert.equal(f.memory.size,1);
 assert.equal((await f.service.descartar()).vacio,true);assert.equal(f.rows.size,0);assert.equal(f.memory.size,0);
});
test('respuesta upload perdida conserva preparación; no limpia a ciegas',async()=>{
 const f=fixture({failures:{'upload.plantillas-zip':{after:true,error:{message:'offline'},once:true}}});
 const r=await f.service.crear(datos(),files());assert.equal(r.recuperable,true);assert.equal(f.rows.size,1);
 assert.ok(!f.trace.some(s=>s.startsWith('remove.')));assert.equal((await f.service.comprobar()).preparada,true);
 assert.equal((await f.service.descartar()).vacio,true);assert.equal(f.rows.size,0);
});
test('respuesta RPC perdida no borra plantilla ya enviada; recuperación confirma',async()=>{
 const f=fixture({failures:{rpc:{after:true,error:{message:'offline'},once:true}}});
 const r=await f.service.crear(datos(),files());assert.equal(r.success,false);assert.equal(r.recuperable,true);
 assert.ok(!f.trace.some(s=>s.startsWith('remove.')));assert.equal((await f.service.comprobar()).success,true);
 assert.equal((await f.service.descartar()).plantilla.estado,'pendiente');assert.equal(f.rows.size,1);
});
test('RPC rechazada conserva preparación sin falso éxito',async()=>{
 const f=fixture({failures:{rpc:{error:{code:'23514'},once:true}}});
 const r=await f.service.crear(datos(),files());assert.equal(r.success,false);assert.equal(r.recuperable,true);
 assert.equal((await f.service.comprobar()).preparada,true);assert.equal((await f.service.descartar()).vacio,true);
});
test('no almacenamiento de referencia: no crea registro',async()=>{
 const f=fixture({storageFails:true});assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.rows.size,0);
});
test('doble envío simultáneo crea una sola plantilla',async()=>{
 const f=fixture();const [a,b]=await Promise.all([f.service.crear(datos(),files()),f.service.crear(datos(),files())]);
 assert.equal(a.success,true);assert.equal(b.ocupado,true);assert.equal(f.rows.size,1);
});
test('recarga conserva referencia e impide duplicar sin confirmar nueva plantilla',async()=>{
 const f=fixture();await f.service.crear(datos(),files());const otra=makeService(f.deps);
 assert.equal((await otra.crear(datos(),files())).recuperable,true);assert.equal(f.rows.size,1);
 assert.equal((await otra.comprobar()).plantilla.estado,'pendiente');
 assert.equal((await otra.nuevo()).success,true);assert.equal((await otra.crear(datos(),files())).success,true);assert.equal(f.rows.size,2);
});
test('Web Locks evita envío de otra pestaña',async()=>{
 const f=fixture({locks:{request:async(name,options,cb)=>cb(null)}});
 assert.equal((await f.service.crear(datos(),files())).ocupado,true);assert.equal(f.rows.size,0);
});
test('cambio de cuenta antes de escribir se detiene',async()=>{
 const f=fixture({sessionHook:(n,change)=>{if(n===2)change();}});
 assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.rows.size,0);
});
test('categorías fallidas o vacías no se confunden con éxito',async()=>{
 for(const config of [{emptyCategories:true},{failures:{'categorias.select':{error:{code:'42501'}}}}]){
 const f=fixture(config);assert.equal((await f.service.crear(datos(),files())).success,false);assert.equal(f.rows.size,0);}
});
test('callback de progreso no puede invalidar el resultado guardado',async()=>{
 const f=fixture();assert.equal((await f.service.crear(datos(),files(),()=>{throw Error('UI');})).success,true);
});
