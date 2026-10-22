// Pruebas puras de lógica financiera. No se conectan a Supabase.
const assert = require('node:assert/strict');
const test = require('node:test');
const factory = require('../js/pagos-api.js');
const api = factory({cliente:()=>{throw Error('No se debe conectar')}, sesion:()=>{throw Error('No se debe autenticar')},
  uuid:()=>{throw Error('No se debe generar solicitud')},
  memoria:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  imagen:()=>{throw Error('No se debe subir archivo')}});

test('20% comisión: dos ventas verificadas', () => {
  const result=api.balance([
    {estado_pago:'verificado',ingreso_vendedor:80},
    {estado_pago:'verificado',ingreso_vendedor:40},
    {estado_pago:'pendiente',ingreso_vendedor:99}
  ],[]);
  assert.deepEqual(result,{total:120,reservado:0,pagado:0,disponible:120});
});
test('reservas y retiros pagados descuentan saldo sin doble conteo', () => {
  const result=api.balance([{estado_pago:'verificado',ingreso_vendedor:100}],[
    {estado:'pendiente',monto:20},{estado:'aprobado',monto:15},
    {estado:'pagado',monto:35},{estado:'rechazado',monto:90}]);
  assert.deepEqual(result,{total:100,reservado:35,pagado:35,disponible:30});
});
test('usa centavos para evitar errores flotantes', () => {
  const r=api.balance([{estado_pago:'verificado',ingreso_vendedor:0.1},
    {estado_pago:'verificado',ingreso_vendedor:0.2}],[{estado:'pagado',monto:0.1}]);
  assert.equal(r.disponible,0.2);
});
