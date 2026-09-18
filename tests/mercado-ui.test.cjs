const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('js/mercado-ui.js','utf8');
function setup(mode,extra={},payments={}) {
 const elements=new Map(),calls=[],events={},sessionEvents=[],timers=[];
 class Element {
  constructor(tag,text=''){this.tagName=tag;this.textContent=text;this.children=[];this.listeners={};this.style={};this.value='';this.disabled=false;this.isConnected=true;this.files=[];}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  add(option){this.append(option);}
  setAttribute(k,v){this[k]=v;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  reportValidity(){return true;}
  remove(){}
  click(){return this.listeners.click?.();}
 }
 for(const id of ['market-content','market-status','market-reload'])elements.set(id,new Element('div'));
 const all=()=>{const out=[];function walk(e){out.push(e);e.children?.forEach(walk);}elements.forEach(walk);return out;};
 const api={categorias:async()=>[{id:1,nombre:'Web'}],propias:async()=>[],pendientes:async()=>[],publicadas:async()=>[],favoritos:async()=>[],pedidos:async()=>[],detalle:async()=>null,
  galeria:async()=>[],imagen:async()=>new Blob(),editable:p=>p.estado==='rechazada'||!p.enviada_revision_at, ...extra};
 for(const key of Object.keys(api)){const fn=api[key];api[key]=(...args)=>{calls.push({key,args});return fn(...args);};}
 const win={TemboraMercado:api,TemboraPagos:payments,accesoPagina:Promise.resolve(extra.access!==false),addEventListener:(name,fn)=>events[name]=fn};
 const document={body:{dataset:{market:mode}},createElement:tag=>new Element(tag),getElementById:id=>elements.get(id),addEventListener:(name,fn)=>events[name]=fn,querySelectorAll:()=>all().filter(e=>['button','input','textarea','select'].includes(e.tagName))};
 const ctx={window:win,document,navigator:{},location:{search:'?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reload:()=>calls.push({key:'reload'})},
  supabaseClient:{auth:{onAuthStateChange:fn=>sessionEvents.push(fn)}},Intl,URL:Object.assign(URL,{createObjectURL:()=> 'blob:unit',revokeObjectURL:()=>{}}),URLSearchParams,
  Option:class extends Element {constructor(t,v){super('option',t);this.value=v;}},confirm:()=>true,setTimeout:fn=>timers.push(fn),localStorage:{getItem:()=>null},
  redirigirSegunRol:async()=>calls.push({key:'panel'})};
 vm.runInNewContext(source,ctx);
 return {calls,elements,all,init:()=>events.DOMContentLoaded(),click:text=>{const e=all().find(e=>e.tagName==='button'&&e.textContent===text);assert.ok(e,text);return e.click();},session:(...args)=>sessionEvents[0](...args),timers};
}
test('guard denegado no carga filas privadas',async()=>{
 const f=setup('vendedor',{access:false});await f.init();assert.equal(f.calls.length,0);
});
test('vendedor muestra estados/rechazo como texto y solo ofrece editar lo permitido',async()=>{
 const f=setup('vendedor',{propias:async()=>[
  {id:'a',nombre:'<img onerror=alert(1)>',estado:'pendiente',precio:20,enviada_revision_at:'2026-09-16'},
  {id:'b',nombre:'Corregible',estado:'rechazada',precio:20,motivo_rechazo:'Imagen borrosa'}]});
 await f.init();assert.equal(f.all().filter(e=>e.textContent==='Editar / corregir').length,1);
 assert.ok(f.all().some(e=>e.textContent==='Motivo de rechazo: Imagen borrosa'));
 assert.ok(f.all().some(e=>e.textContent==='Pendiente de aprobación'));
 assert.ok(f.all().some(e=>e.textContent==='<img onerror=alert(1)>'));
});
test('admin no anuncia publicación cuando falla RPC',async()=>{
 const f=setup('admin',{pendientes:async()=>[{id:'a',nombre:'X',precio:20,enviada_revision_at:'2026-09-16'}],revisar:async()=>{throw Error('No autorizado');}});
 await f.init();await f.click('Revisar plantilla');await f.click('Aprobar y publicar');
 assert.match(f.elements.get('market-status').textContent,/No autorizado/);
 assert.ok(!f.elements.get('market-status').textContent.includes('Plantilla publicada'));
});
test('doble clic en revisión ejecuta una sola operación',async()=>{
 let release;const deferred=new Promise(r=>release=r);
 const f=setup('admin',{pendientes:async()=>[{id:'a',nombre:'X',precio:20,enviada_revision_at:'2026-09-16'}],revisar:async()=>deferred});
 await f.init();await f.click('Revisar plantilla');const a=f.click('Aprobar y publicar');const b=f.click('Aprobar y publicar');
 assert.equal(f.calls.filter(x=>x.key==='revisar').length,1);release();await Promise.all([a,b]);
});
test('catálogo vacío se distingue de fallo de conexión',async()=>{
 const empty=setup('catalogo');await empty.init();assert.match(empty.elements.get('market-status').textContent,/0 plantilla/);
 const fail=setup('catalogo',{publicadas:async()=>{throw Error('Sin conexión');}});await fail.init();assert.equal(fail.elements.get('market-status').textContent,'Sin conexión');
});
test('detalle no publicado no ofrece favoritos ni contenido ficticio',async()=>{
 const f=setup('detalle');await f.init();assert.match(f.elements.get('market-status').textContent,/no disponible/);
 assert.ok(!f.all().some(e=>e.textContent==='Guardar en favoritos'));
});
test('cambio de cuenta limpia filas antes de recargar',async()=>{
 const f=setup('vendedor',{propias:async()=>[{id:'a',nombre:'Privado',estado:'rechazada',precio:20}]});
 f.session('INITIAL_SESSION',{user:{id:'uno'}});await f.init();assert.ok(f.elements.get('market-content').children.length);
 f.session('SIGNED_IN',{user:{id:'dos'}});assert.equal(f.elements.get('market-content').children.length,0);
 f.timers.forEach(fn=>fn());assert.ok(f.calls.some(c=>c.key==='reload'));
});
test('comprador pendiente muestra instrucciones reales del pedido sin descarga',async()=>{
 const order={id:'p',plantilla_nombre:'Web',monto:100,estado_pago:'pendiente',yape_numero:'900000000',yape_titular:'TEMP'};
 const f=setup('comprador',{}, {compras:async()=>[order],pedido:async()=>order});await f.init();await f.click('Ver pedido / pagar');
 assert.ok(f.all().some(e=>e.textContent==='Número: 900000000'));assert.ok(!f.all().some(e=>e.textContent==='Descargar ZIP'));
 assert.ok(f.all().some(e=>e.textContent==='Enviar comprobante'));
});
test('comprobante enviado muestra espera sin volver a ofrecer pago',async()=>{
 const order={id:'p',plantilla_nombre:'Web',monto:100,estado_pago:'pendiente',enviada_pago_at:'2026-09-16'};
 const f=setup('comprador',{}, {compras:async()=>[order],pedido:async()=>order});await f.init();await f.click('Ver pedido / pagar');
 assert.ok(f.all().some(e=>e.textContent.includes('No vuelvas a pagar')));assert.ok(!f.all().some(e=>e.textContent==='Enviar comprobante'));
});
test('compra aprobada muestra descarga y no solicita otro pago',async()=>{
 const order={id:'p',plantilla_nombre:'Web',monto:100,estado_pago:'verificado'};
 const f=setup('comprador',{}, {compras:async()=>[order],pedido:async()=>order});await f.init();await f.click('Ver compra / descargar');
 assert.ok(f.all().some(e=>e.textContent==='Descargar ZIP'));assert.ok(!f.all().some(e=>e.textContent==='Enviar comprobante'));
});
test('fallo de aprobación no anuncia descarga habilitada',async()=>{
 const order={id:'p',plantilla_nombre:'Web',monto:100,estado_pago:'pendiente',enviada_pago_at:'2026-09-16'};
 const f=setup('admin',{}, {pedidosAdmin:async()=>[order],revisar:async()=>{throw Error('Operación duplicada');}});
 await f.init();await f.click('Pagos y ventas');await f.click('Confirmar abono y habilitar descarga');assert.match(f.elements.get('market-status').textContent,/Operación duplicada/);
});

test('ruta de compra sin acceso no consulta el pedido',async()=>{
 let read=false;const f=setup('compra',{access:false},{pedido:async()=>{read=true;}});
 await f.init();assert.equal(read,false);
});

test('usuarios renderiza nombres sin interpretar HTML y muestra rol real',async()=>{
 const f=setup('admin',{usuarios:async()=>[{id:'u',nombre_completo:'<script>malicioso</script>',rol:'comprador'}]});
 await f.init();await f.click('Usuarios');
 assert.ok(f.all().some(e=>e.textContent==='<script>malicioso</script>'));
 assert.ok(f.all().some(e=>e.tagName==='select'&&e.value==='comprador'));
});

test('perfil permite editar nombre y biografía sin selector de rol',async()=>{
 const f=setup('vendedor',{miPerfil:async()=>({nombre_completo:'Ana',bio:'Web',rol:'vendedor'})});
 await f.init();await f.click('Mi perfil');
 assert.ok(f.all().some(e=>e.textContent==='Rol: vendedor'));
 assert.ok(!f.all().some(e=>e.tagName==='select'));
});
