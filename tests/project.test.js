const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const E=require('../dist/engine.js');
function fixture(){
 let model={name:'端盖',source:'CAD：原图 · 所选结构',basis:'毛坯尺寸',density:7.2,quantity:2,segments:Array.from({length:181},(_,i)=>({name:'积分段',op:'add',z:i,h:1,D0:100,D1:100,d0:80,d1:80})),corrections:[{type:'volume',name:'筋板',op:'add',a:1.875,count:3}]};
 const elements=Object.fromEntries(['saveProject','loadProject','projectStatus'].map(id=>[id,{}]));let blob;
 const scope={document:{getElementById:id=>elements[id],createElement:()=>({click(){}})},Blob,URL:{createObjectURL:b=>(blob=b,'blob:test'),revokeObjectURL(){}},setTimeout:fn=>fn(),CastingEngine:E,CastingApp:{getModel:()=>structuredClone(model),setModel:m=>{const result=E.calculate(m);if(!result.valid)throw Error(result.errors.join(' '));model=m;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/project.js'),'utf8'),scope);
 return {elements,get model(){return model;},get blob(){return blob;},load:text=>elements.loadProject.onchange({target:{files:[{size:text.length,text:async()=>text}],value:'x'}})};
}
test('saved CAD profile and feature count survive project round trip',async()=>{
 const f=fixture(),before=E.calculate(f.model).weight;f.elements.saveProject.onclick();const saved=await f.blob.text();await f.load(saved);
 assert.equal(f.model.segments.length,181);assert.equal(f.model.corrections[0].count,3);assert.equal(E.calculate(f.model).weight,before);assert.equal(f.model.basis,'毛坯尺寸');assert.match(f.elements.projectStatus.textContent,/已载入/);
});
test('bad or incompatible project leaves the existing model intact',async()=>{
 const f=fixture(),before=JSON.stringify(f.model);await f.load('{oops');assert.match(f.elements.projectStatus.textContent,/载入失败/);assert.equal(JSON.stringify(f.model),before);
 await f.load(JSON.stringify({format:'casting-weight-project',version:2,model:f.model}));assert.equal(JSON.stringify(f.model),before);
});
test('invalid imported geometry cannot replace current weight',async()=>{
 const f=fixture(),before=JSON.stringify(f.model),m=structuredClone(f.model);m.segments[0].d0=200;
 await f.load(JSON.stringify({format:'casting-weight-project',version:1,model:m}));assert.match(f.elements.projectStatus.textContent,/载入失败/);assert.equal(JSON.stringify(f.model),before);
});
