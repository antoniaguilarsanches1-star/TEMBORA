const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const make=require('../js/pagos-api.js');

test('revisión final exclusiva de retiros',async t=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 t.after(()=>browser.close());
 const errors=[];
 async function escenario(total,withdrawals=[]) {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<body data-market="vendedor"><main id="market-root"><p id="market-status"></p><button id="market-reload">Actualizar</button><div id="market-content"></div></main></body>');
  await page.addScriptTag({content:'var module={exports:{}};'+fs.readFileSync('js/pagos-api.js','utf8')});
  await page.evaluate(({total,withdrawals})=>{
   window.testRows=withdrawals;window.testCalls=[];window.testSummary='';
   const orders=[{estado_pago:'verificado',ingreso_vendedor:total,vendedor_id:'seller',monto:total/0.8,plantilla_nombre:'Prueba'}];
   const memory=new Map();
   const client={from:table=>{const rows=table==='retiros'?window.testRows:orders;const filters=[];
    const q={select:()=>q,order:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},range:async()=>({data:rows.filter(r=>filters.every(([k,v])=>r[k]===v))})};return q;},
    rpc:async(name,args)=>{window.testCalls.push(args);await new Promise(r=>setTimeout(r,80));window.testRows.push({id:'r',vendedor_id:'seller',solicitud_id:args.p_solicitud,estado:'pendiente',monto:args.p_monto,destino_numero:args.p_numero,destino_titular:args.p_titular,created_at:'2026-09-30T12:00:00Z'});return {data:'r'};}};
   window.TemboraPagos=module.exports({cliente:()=>client,sesion:async()=>({success:true,rol:'vendedor',user:{id:'seller'}}),uuid:()=> 'request-id',memoria:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}});
   window.TemboraMercado={categorias:async()=>[],propias:async()=>[]};window.accesoPagina=Promise.resolve(true);
   window.confirm=message=>{window.testSummary=message;return true;};
  },{total,withdrawals});
  await page.addScriptTag({content:fs.readFileSync('js/mercado-ui.js','utf8')});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await page.getByText('Ventas, ganancias y retiros',{exact:true}).click();
  await page.locator('#edit-retiro-monto').waitFor();
  return page;
 }
 const low=await escenario(39.20);
 assert.equal(await low.locator('#edit-retiro-monto').inputValue(),'39.20');
 assert.equal(await low.getByText('Solicitar retiro',{exact:true}).isDisabled(),true);
 assert.match(await low.locator('#market-content').innerText(),/10[.,]80/);
 assert.equal(await low.locator('#edit-retiro-monto').evaluate(e=>e.readOnly),true);
 await low.close();
 const high=await escenario(80.08);
 assert.equal(await high.locator('#edit-retiro-monto').inputValue(),'80.08');
 assert.equal(await high.getByText('Solicitar retiro',{exact:true}).isDisabled(),false);
 for(const [number,name] of [['12345678','Ana'],['12345678a','Ana'],['123456789','A'],['123456789','Ana1']]) {
  await high.locator('#edit-retiro-numero').fill(number);await high.locator('#edit-retiro-titular').fill(name);
  assert.equal(await high.locator('form').evaluate(e=>e.checkValidity()),false);
 }
 await high.locator('#edit-retiro-numero').fill('123456789');await high.locator('#edit-retiro-titular').fill('José Pérez');
 await high.evaluate(()=>{document.getElementById('edit-retiro-monto').value='999';const form=document.querySelector('form');form.requestSubmit();form.requestSubmit();});
 await high.waitForFunction(()=>document.getElementById('market-status').textContent.includes('Solicitud registrada'));
 const result=await high.evaluate(()=>({calls:window.testCalls,summary:window.testSummary}));
 assert.equal(result.calls.length,1);assert.equal(result.calls[0].p_monto,80.08);
 assert.match(result.summary,/80[.,]08/);assert.match(result.summary,/123456789/);assert.match(result.summary,/José Pérez/);
 assert.equal(await high.getByText('Solicitar retiro',{exact:true}).isDisabled(),true);
 assert.equal(await high.locator('#edit-retiro-monto').inputValue(),'0.00');
 await high.close();
 for(const estado of ['pendiente','aprobado','rechazado','pagado']) {
  const row={id:'r',vendedor_id:'seller',estado,monto:80,destino_numero:'123456789',destino_titular:'José Pérez',created_at:'2026-09-30T12:00:00Z',pagado_at:estado==='pagado'?'2026-09-30T13:00:00Z':null,referencia_pago:estado==='pagado'?'YAPE123':null};
  const page=await escenario(160,[row]);
  assert.equal(await page.locator('#edit-retiro-monto').inputValue(),estado==='rechazado'?'160.00':'80.00');
  assert.equal(await page.getByText('Solicitar retiro',{exact:true}).isDisabled(),['pendiente','aprobado'].includes(estado));
  const text=await page.locator('#market-content').innerText();
  assert.match(text,/Fecha de solicitud/);assert.match(text,/123456789/);assert.match(text,/José Pérez/);
  if(estado==='pagado'){assert.match(text,/Fecha de pago/);assert.match(text,/YAPE123/);}
  const b=make({}).balance([{estado_pago:'verificado',ingreso_vendedor:160}],[row]);
  assert.equal(b.reservado,['pendiente','aprobado'].includes(estado)?80:0);
  assert.equal(b.pagado,estado==='pagado'?80:0);
  await page.close();
 }
 assert.deepEqual(errors,[]);
});
