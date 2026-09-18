const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code=fs.readFileSync(require.resolve('../js/vender.js'),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function ui(options={}) {
 class Element {
  constructor(){this.hidden=false;this.disabled=false;this.value='value';this.textContent='';this.files=[];this.events={};this.attrs={};}
  addEventListener(name,fn){this.events[name]=fn;}
  setAttribute(k,v){this.attrs[k]=v;}
  replaceChildren(...v){this.options=v;}
  add(o){this.options.push(o);}
  reportValidity(){return options.valid!==false;}
  reset(){this.resetCalled=true;}
 }
 const elements=new Map();
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},
 addEventListener:(name,fn)=>{document[name]=fn;}};
 const calls=[];
 const service={categorias:async()=>{calls.push('cats');if(options.catsFail)throw Error('Categorías no disponibles');return [{id:1,nombre:'<b>Nombre literal</b>'}];},
 comprobar:async()=>options.state || {success:true,vacio:true},descartar:async()=>({success:true,vacio:true}),
 nuevo:async()=>({success:true,vacio:true})};
 const window={accesoPagina:Promise.resolve(true),TemboraEnvios:service,addEventListener:()=>{}};
 const context={window,document,Option:class{constructor(text,value){this.text=text;this.value=value;}},
 verificarSesion:async()=>({success:true,rol:options.role||'vendedor'}),
 crearPlantilla:async(...args)=>{calls.push('create');return options.create ? options.create(...args) : {success:true,plantilla:{id:'id-1',estado:'pendiente'},message:'Pendiente de aprobación'};}};
 vm.runInNewContext(code,context);
 document.DOMContentLoaded();
 return {elements,window,service,calls,form:document.getElementById('sell-form'),get:id=>document.getElementById(id)};
}
test('categorías dinámicas como texto y formulario habilitado solo tras carga',async()=>{
 const h=ui();assert.equal(h.get('sell-fields').disabled,true);await turn();
 assert.equal(h.get('sell-fields').disabled,false);assert.equal(h.get('category').options[1].value,'1');
 assert.equal(h.get('category').options[1].text,'<b>Nombre literal</b>');
});
test('error de categorías permite reintentar sin habilitar envío',async()=>{
 const h=ui({catsFail:true});await turn();assert.equal(h.get('sell-fields').disabled,true);
 assert.equal(h.get('sell-retry').hidden,false);await h.window.TemboraVenta.enviar(h.form);assert.ok(!h.calls.includes('create'));
});
for(const role of ['admin','comprador'])test('interfaz bloqueada para '+role,async()=>{
 const h=ui({role});await turn();assert.equal(h.get('sell-fields').disabled,true);assert.equal(h.calls.length,0);
});
test('formulario inválido no llama creación',async()=>{
 const h=ui({valid:false});await turn();await h.window.TemboraVenta.enviar(h.form);assert.ok(!h.calls.includes('create'));
});
test('durante el envío no se puede duplicar; éxito muestra referencia y pendiente',async()=>{
 let finish;const h=ui({create:()=>new Promise(r=>finish=r)});await turn();
 const pending=h.window.TemboraVenta.enviar(h.form);
 assert.equal(h.get('sell-fields').disabled,true);assert.equal(h.form.attrs['aria-busy'],'true');
 await h.window.TemboraVenta.enviar(h.form);assert.equal(h.calls.filter(x=>x==='create').length,1);
 finish({success:true,plantilla:{id:'id-1',estado:'pendiente'},message:'Pendiente de aprobación'});
 await pending;assert.equal(h.get('sell-fields').disabled,true);assert.equal(h.get('sell-status').textContent,'Pendiente de aprobación');
 assert.equal(h.get('sell-reference').textContent,'Referencia: id-1');assert.equal(h.get('sell-new').hidden,false);
});
test('fallo limpiado mantiene datos del formulario y permite reintento',async()=>{
 const h=ui({create:async()=>({success:false,error:'Falló y se limpió'})});await turn();
 await h.window.TemboraVenta.enviar(h.form);assert.equal(h.get('sell-fields').disabled,false);assert.ok(!h.form.resetCalled);
 assert.equal(h.get('sell-status').textContent,'Falló y se limpió');
});
test('envío recuperable bloquea nueva creación y ofrece comprobar estado',async()=>{
 const h=ui({state:{success:false,recuperable:true,preparada:true,id:'id-2',error:'Sin enviar'}});await turn();
 assert.equal(h.get('sell-fields').disabled,true);assert.equal(h.get('sell-check').hidden,false);assert.equal(h.get('sell-discard').hidden,false);
});
test('HTML conserva campos, límites y orden de dependencias',()=>{
 const html=fs.readFileSync(require.resolve('../vender.html'),'utf8');
 assert.match(html,/id="sell-fields" disabled/);assert.match(html,/id="price"[^>]+min="20"/);
 assert.match(html,/id="description"[^>]+minlength="100"/);
 assert.ok(html.indexOf('src="js/supabase.js"')<html.indexOf('src="js/plantillas-envio.js"'));
 assert.ok(html.indexOf('src="js/plantillas-envio.js"')<html.indexOf('src="js/vender.js"'));
 assert.ok(!html.includes('<option value="Negocios">'));
});
