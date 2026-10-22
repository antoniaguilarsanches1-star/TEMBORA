// Phase 9: unit tests run without live keys, real accounts, or network.
// node --test tests/phase9-marketplace.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const marketplace = require('../js/mercado-api.js');
const payments = require('../js/pagos-api.js');
const BUYER='00000000-0000-4000-8000-000000000001';
const SELLER='00000000-0000-4000-8000-000000000002';
const ADMIN='00000000-0000-4000-8000-000000000003';

function deps(role,id){
  let called=0;
  const client=()=>{called++; throw Error('Unexpected backend call');};
  const session=async()=>({success:true,user:{id},rol:role});
  return {client,session,calls:()=>called};
}
test('buyer cannot access seller templates',async()=>{
  const d=deps('comprador',BUYER);
  const api=marketplace({cliente:d.client,sesion:d.session,validar:()=>{},uuid:()=>BUYER});
  await assert.rejects(()=>api.propias(),/sesión|permite|autorizada/i);
  assert.equal(d.calls(),0);
});
test('buyer cannot request administrative user listing',async()=>{
  const d=deps('comprador',BUYER);
  const api=marketplace({cliente:d.client,sesion:d.session,validar:()=>{},uuid:()=>BUYER});
  await assert.rejects(()=>api.usuarios(),/sesión|permite|autorizada/i);
  assert.equal(d.calls(),0);
});
test('admin cannot change own role',async()=>{
  const d=deps('admin',ADMIN);
  const api=marketplace({cliente:d.client,sesion:d.session,validar:()=>{},uuid:()=>BUYER});
  await assert.rejects(()=>api.cambiarRol(ADMIN,'comprador'),/no permitido/i);
  assert.equal(d.calls(),0);
});
test('role change rejects unsupported roles',async()=>{
  const d=deps('admin',ADMIN);
  const api=marketplace({cliente:d.client,sesion:d.session,validar:()=>{},uuid:()=>BUYER});
  await assert.rejects(()=>api.cambiarRol(SELLER,'superadmin'),/no permitido/i);
  assert.equal(d.calls(),0);
});
test('seller cannot access administrator orders',async()=>{
  const d=deps('vendedor',SELLER);
  const api=payments({cliente:d.client,sesion:d.session,uuid:()=>BUYER,memoria:{getItem:()=>null,setItem(){},removeItem(){}},imagen:()=>{}});
  await assert.rejects(()=>api.pedidosAdmin(),/sesión|autorizada/i);
  assert.equal(d.calls(),0);
});
test('balance deducts pending, approved and paid withdrawals in cents',()=>{
  const api=payments({cliente:()=>null,sesion:async()=>null,uuid:()=>BUYER,memoria:{getItem:()=>null,setItem(){},removeItem(){}},imagen:()=>{}});
  assert.deepEqual(api.balance([{estado_pago:'verificado',ingreso_vendedor:80.10},{estado_pago:'pendiente',ingreso_vendedor:99}], [{estado:'pendiente',monto:10.01},{estado:'aprobado',monto:5.02},{estado:'pagado',monto:20.03}]), {total:80.1,reservado:15.03,pagado:20.03,disponible:45.04});
});
