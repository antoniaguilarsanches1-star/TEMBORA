const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const oauth=fs.readFileSync('js/auth-oauth.js','utf8');
function fixture({enabled={google:true,facebook:true},search='',hash='',session={success:true,rol:'vendedor'},failure=false}={}) {
 const buttons=['google','facebook'].map(p=>({dataset:{oauthProvider:p},hidden:true,disabled:true,addEventListener(k,fn){this.click=fn;}}));
 const elements={'oauth-options':{hidden:true},'oauth-status':{textContent:''}};const calls=[];let init;
 const context={window:{sesionInicial:Promise.resolve()},document:{documentElement:{removeAttribute(){}},querySelectorAll:()=>buttons,getElementById:id=>elements[id]||null,addEventListener:(e,fn)=>init=fn},
 location:{search,hash,pathname:'/TEMBORA/login.html'},history:{replaceState:()=>calls.push('clean')},URLSearchParams,AbortSignal,
 fetch:async()=>({ok:true,json:async()=>({external:enabled})}),supabaseUrl:'https://example.supabase.co',supabaseKey:'public',
 supabaseClient:{auth:{getSession:async()=>({data:{session:null}}),signInWithOAuth:async args=>{calls.push(args);return {error:failure?Error('private details'):null};}}},
 conLimite:x=>x,verificarSesion:async()=>session,irAlPanelVerificado:rol=>calls.push(rol)};
 vm.runInNewContext(oauth,context);return {init,buttons,elements,calls};
}
for(const provider of ['google','facebook'])test('OAuth '+provider+' usa destino de producción y no envía roles',async()=>{
 const f=fixture();await f.init();await f.buttons.find(b=>b.dataset.oauthProvider===provider).click();
 const call=f.calls[0];assert.equal(call.provider,provider);assert.equal(call.options.redirectTo,'https://antoniaguilarsanches1-star.github.io/TEMBORA/login.html?oauth=1');assert.equal(call.options.data,undefined);
});
test('proveedores deshabilitados permanecen ocultos',async()=>{const f=fixture({enabled:{}});await f.init();assert.ok(f.buttons.every(b=>b.hidden));assert.ok(f.elements['oauth-options'].hidden);});
test('callback consulta perfil y usa rol existente',async()=>{const f=fixture({search:'?oauth=1'});await f.init();assert.deepEqual(f.calls,['clean','vendedor']);});
test('callback cancelado y fallo proveedor muestran mensaje sin redirigir ni exponer detalles',async()=>{
 const f=fixture({hash:'#error=access_denied'});await f.init();assert.deepEqual(f.calls,['clean']);assert.match(f.elements['oauth-status'].textContent,/cancelado/);
 const g=fixture({failure:true});await g.init();await g.buttons[0].click();assert.match(g.elements['oauth-status'].textContent,/No se pudo iniciar/);assert.ok(!g.elements['oauth-status'].textContent.includes('private details'));
});
test('callback con perfil inválido nunca asigna rol ni navega',async()=>{const f=fixture({search:'?oauth=1',session:{success:false,code:'INVALID_ROLE',error:'Perfil inválido'}});await f.init();assert.deepEqual(f.calls,['clean']);assert.equal(f.elements['oauth-status'].textContent,'Perfil inválido');});
const auth=fs.readFileSync('js/supabase.js','utf8');const fn=auth.slice(auth.indexOf('async function protegerPagina('),auth.indexOf('async function registrarUsuario('));
function guard(result,options={}){const attrs=new Set(),calls=[];const c={revisionAcceso:0,cierreEnCurso:null,paginaActual:'vender.html',usuarioVisible:'u',rolesDePagina:['vendedor'],document:{documentElement:{hasAttribute:k=>attrs.has(k),setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k)}},bloquearContenido:()=>{calls.push('block');attrs.add('data-auth-pending');},mostrarErrorAuth:()=>{calls.push('error');attrs.add('data-auth-pending');},verificarSesion:async()=>result,irAlPanelVerificado:r=>calls.push(r),window:{location:{replace:x=>calls.push(x),reload:()=>calls.push('reload')}},...options};vm.runInNewContext(fn,c);return {c,attrs,calls};}
test('revalidación vendedor no colapsa contenido ni sustituye formulario',async()=>{const f=guard({success:true,rol:'vendedor',user:{id:'u'}});assert.equal(await f.c.protegerPagina(undefined,true),true);assert.deepEqual(f.calls,[]);assert.equal(f.attrs.size,0);});
test('revalidación mantiene bloqueo en error y cambio de cuenta',async()=>{for(const code of ['NO_SESSION','SESSION_ERROR','CONNECTION_ERROR']){const f=guard({success:false,code});await f.c.protegerPagina(undefined,true);assert.ok(f.calls.includes(code==='CONNECTION_ERROR'?'error':'login.html'));assert.ok(f.attrs.has('data-auth-pending'));}const f=guard({success:true,rol:'vendedor',user:{id:'otro'}});await f.c.protegerPagina(undefined,true);assert.deepEqual(f.calls,['block','reload']);});
for(const [page,rol] of [['admin.html','admin'],['panel-comprador.html','comprador'],['panel-vendedor.html','vendedor'],['vender.html','vendedor'],['compra.html','comprador']])test('sesión válida no oculta '+page,async()=>{
 const f=guard({success:true,rol,user:{id:'u'}},{paginaActual:page,rolesDePagina:[rol]});
 for(let i=0;i<3;i++)assert.equal(await f.c.protegerPagina(),true);
 assert.deepEqual(f.calls,[]);assert.equal(f.attrs.size,0);
});
test('primera entrada bloquea hasta validar; cambio de rol bloquea antes de redirigir',async()=>{
 const f=guard({success:true,rol:'vendedor',user:{id:'u'}},{usuarioVisible:null});await f.c.protegerPagina();assert.deepEqual(f.calls,['block']);assert.equal(f.attrs.size,0);
 const g=guard({success:true,rol:'comprador',user:{id:'u'}});await g.c.protegerPagina();assert.deepEqual(g.calls,['block','comprador']);
});

test('callback social sin perfil continúa en selección de rol',async()=>{
 const source=oauth.replaceAll("location.replace('elegir-rol.html');", "irAlPanelVerificado('SELECCION');");
 // La sustitución solo espía navegación, sin invocar un navegador real.
 let init;const calls=[];
 const c={window:{sesionInicial:Promise.resolve()},document:{documentElement:{removeAttribute(){}},addEventListener:(e,fn)=>init=fn,getElementById:()=>({textContent:''})},location:{search:'?oauth=1',hash:'',pathname:'/login.html'},URLSearchParams,history:{replaceState(){}},verificarSesion:async()=>({success:false,code:'NEEDS_ROLE'}),irAlPanelVerificado:r=>calls.push(r)};
 vm.runInNewContext(source,c);await init();assert.deepEqual(calls,['SELECCION']);
});
