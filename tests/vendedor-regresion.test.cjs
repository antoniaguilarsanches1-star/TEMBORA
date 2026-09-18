const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('formulario vendedor no recibe tarjetas de demostración del renderizador antiguo',()=>{
 const source=fs.readFileSync('js/app.js','utf8');
 const start=source.indexOf('function renderTemplates()');
 const end=source.indexOf('function renderFeaturedTemplates()',start);
 let queried=false;
 const context={document:{body:{dataset:{}},getElementById:id=>id==='sell-form'?{}:null,querySelector(){queried=true;throw Error('No debe renderizar demos');}}};
 vm.runInNewContext(source.slice(start,end)+'\nrenderTemplates();',context);
 assert.equal(queried,false);
});
test('controles hidden conservan ocultación frente a estilos de botones',()=>{
 assert.match(fs.readFileSync('css/styles.css','utf8'),/\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});
