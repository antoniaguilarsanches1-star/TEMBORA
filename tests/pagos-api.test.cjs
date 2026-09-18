const {test}=require('node:test');const assert=require('node:assert/strict');const make=require('../js/pagos-api.js');
function fixture(role='comprador') {
 const calls=[],memory=new Map(),rows=[{id:'pedido',comprador_id:'buyer',estado_pago:'pendiente',enviada_pago_at:null,monto:100,zip_path:'seller/template/file.zip'}];
 let fail='',account='buyer';
 const client={from:table=>{
  const q={filters:[],select(){return q;},order(){return q;},eq(k,v){q.filters.push([k,v]);return q;},
   async single(){return {data:rows.find(r=>q.filters.every(([k,v])=>r[k]===v))};},async range(){return {data:rows.filter(r=>q.filters.every(([k,v])=>r[k]===v))};}};return q;
 },rpc:async(name,args)=>{calls.push({rpc:name,args});if(fail==='rpc')return {error:{message:'lost response'}};
  if(name==='tembora_enviar_comprobante')Object.assign(rows[0],{comprobante_url:args.p_ruta,enviada_pago_at:'2026-09-16'});
  return {data:name==='tembora_crear_pedido'?'pedido':'retiro'};
 },storage:{from:bucket=>({upload:async(path,file,opts)=>{calls.push({upload:bucket,path,opts});if(fail==='upload')return {error:{message:'lost upload'}};return {data:{path}};},download:async path=>{calls.push({download:bucket,path});return {data:new Blob(['bytes'])};}})}};
 const api=make({cliente:()=>client,sesion:async()=>({success:!!account,rol:role,user:{id:account}}),uuid:()=> 'unique',
  memoria:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},imagen:async f=>{if(!f)throw Error('Imagen inválida');return {ext:'png',mime:'image/png'};}});
 return {api,calls,memory,rows,fail:x=>fail=x,account:x=>account=x};
}
test('pedido se crea solo por RPC con ID de plantilla, sin importe/estado del cliente',async()=>{
 const f=fixture();const r=await f.api.crear('template');assert.equal(r.id,'pedido');assert.deepEqual(f.calls[0],{rpc:'tembora_crear_pedido',args:{p_plantilla:'template'}});
});
for(const role of ['vendedor','admin'])test(role+' no crea pedidos desde UI comprador',async()=>{
 const f=fixture(role);await assert.rejects(()=>f.api.crear('template'));assert.equal(f.calls.length,0);
});
test('comprobante privado con UUID y sin upsert, registro posterior y recuperación limpia',async()=>{
 const f=fixture();await f.api.subir('pedido',{});assert.deepEqual(f.calls[0],{upload:'comprobantes',path:'buyer/pedido/unique.png',opts:{contentType:'image/png',upsert:false}});
 assert.equal(f.calls[1].rpc,'tembora_enviar_comprobante');assert.equal(f.memory.size,0);
});
test('archivo inválido no sube ni crea referencia',async()=>{
 const f=fixture();await assert.rejects(()=>f.api.subir('pedido',null));assert.equal(f.calls.length,0);assert.equal(f.memory.size,0);
});
test('respuesta perdida conserva referencia y recuperación usa misma ruta',async()=>{
 const f=fixture();f.fail('rpc');await assert.rejects(()=>f.api.subir('pedido',{}));assert.equal(f.memory.size,1);
 f.fail('');await f.api.recuperar('pedido');assert.equal(f.calls.filter(c=>c.upload).length,1);assert.equal(f.memory.size,0);
});
test('subida fallida no muestra comprobante recibido ni borra referencia',async()=>{
 const f=fixture();f.fail('upload');await assert.rejects(()=>f.api.subir('pedido',{}));assert.equal(f.calls.length,1);assert.equal(f.memory.size,1);
});
for(const estado of ['pendiente','rechazado'])test('ZIP bloqueado con pago '+estado,async()=>{
 const f=fixture();f.rows[0].estado_pago=estado;await assert.rejects(()=>f.api.descargar('pedido'));assert.equal(f.calls.length,0);
});
test('ZIP verificado requiere revisor y usa Storage autenticado',async()=>{
 const f=fixture();f.rows[0].estado_pago='verificado';await assert.rejects(()=>f.api.descargar('pedido'));
 f.rows[0].revisado_por='admin';await f.api.descargar('pedido');assert.equal(f.calls[0].download,'plantillas-zip');
});
test('comprador no revisa pagos ni retiros ni configura destinatario',async()=>{
 const f=fixture();await assert.rejects(()=>f.api.revisar('pedido',true,'op'));await assert.rejects(()=>f.api.revisarRetiro('r','pagado','op'));await assert.rejects(()=>f.api.configurar('999999999','test'));assert.equal(f.calls.length,0);
});
test('saldo cuenta solo verificados y reserva pendiente/aprobado, no rechazado',()=>{
 const f=fixture();assert.deepEqual(f.api.balance([{estado_pago:'verificado',ingreso_vendedor:'80.08'},{estado_pago:'pendiente',ingreso_vendedor:99}],
 [{estado:'pendiente',monto:10},{estado:'aprobado',monto:10},{estado:'pagado',monto:20},{estado:'rechazado',monto:100}]),{total:80.08,reservado:20,pagado:20,disponible:40.08});
});
test('retiro conserva ID ante respuesta perdida, sin guardar datos de destino',async()=>{
 const f=fixture('vendedor');f.fail('rpc');await assert.rejects(()=>f.api.solicitar(50,'900000000','TEMP'));
 assert.deepEqual([...f.memory.values()],['unique']);f.fail('');await f.api.solicitar(50,'900000000','TEMP');
 assert.equal(f.calls[0].args.p_solicitud,f.calls[1].args.p_solicitud);assert.equal(f.memory.size,0);
});

test('carga del módulo funciona aunque el navegador bloquee almacenamiento local',()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const window={};Object.defineProperty(window,'localStorage',{get(){throw Error('Almacenamiento bloqueado');}});
 vm.runInNewContext(fs.readFileSync('js/pagos-api.js','utf8'),{window});
 assert.equal(typeof window.TemboraPagos.compras,'function');
});
