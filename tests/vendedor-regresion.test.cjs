const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('no hay datos de demostración en app.js',()=>{
 const source=fs.readFileSync('js/app.js','utf8');
 assert.equal(source.includes('DEMO_DATA'),false);
 assert.equal(source.includes('renderTemplates'),false);
 assert.equal(source.includes('renderFeaturedTemplates'),false);
 assert.equal(source.includes('renderCategories'),false);
 assert.equal(source.includes('renderSellers'),false);
});

test('controles hidden conservan ocultación frente a estilos de botones',()=>{
 assert.match(fs.readFileSync('css/styles.css','utf8'),/\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});
