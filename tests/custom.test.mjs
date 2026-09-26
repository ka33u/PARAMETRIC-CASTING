import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {fresh,normalize,buildDesign,FAMILIES,activeOptions} from '../parametric/catalog.mjs';
import {SHAPES,newComponent,parseProfile} from '../parametric/custom.mjs';
import {evaluateDesign,stlBinary} from '../parametric/solid.mjs';
const wasm=await Module();wasm.setup();
const evaluate=(s,mesh=false)=>evaluateDesign(wasm,s,{includeMesh:mesh});
const near=(a,b,t=.0007)=>assert.ok(Math.abs(a-b)<Math.max(1e-6,Math.abs(b)*t),`${a} vs ${b}`);
const state=(...components)=>({...fresh('custom'),components});
for(const type of Object.keys(SHAPES))test(`custom ${type} makes a positive connected solid`,()=>{const r=evaluate(state(newComponent(type)));assert.equal(r.components,1);assert.ok(r.volume>0);near(r.parts[0].volume,r.volume,1e-9);});
test('custom primitive volumes agree with analytic formulas',()=>{
 const volumes={cylinder:Math.PI*50**2*40,tube:Math.PI*(75**2-40**2)*30,box:100*70*20,cone:Math.PI*60/3*(50**2+50*25+25**2),conetube:Math.PI*60/3*(60**2+60*40+40**2-45**2-45*25-25**2),wedge:70*8*50/2,sphere:4/3*Math.PI*40**3,torus:2*Math.PI**2*50*8**2,capsule:60*40*20+Math.PI*20**2*20,regular:6*40**2*Math.sin(Math.PI/3)/2*25};
 for(const [type,v] of Object.entries(volumes))near(evaluate(state(newComponent(type))).volume,v,.001);
 const cone=newComponent('cone');cone.values.endD=0;near(evaluate(state(cone)).volume,Math.PI*50**2*60/3);
});
test('overlapping material and intersecting cuts are counted once',()=>{
 const a=newComponent('box','a');a.values={L:100,W:100,H:20};const b=structuredClone(a);b.id='b';b.position[0]=50;
 const hole=newComponent('cylinder','hole');hole.operation='cut';hole.values={D:20,H:22};hole.position=[0,0,-1];
 const r=evaluate(state(a,b,hole));near(r.volume,150*100*20-Math.PI*10**2*20);near(r.parts.reduce((v,p)=>v+p.volume,0),r.volume,1e-9);
 const duplicate=structuredClone(hole);duplicate.id='hole2';near(evaluate(state(a,hole,b,duplicate)).volume,r.volume,1e-9);
 hole.position=[1000,0,0];const outside=evaluate(state(a,b,hole));near(outside.volume,150*100*20,1e-9);assert.match(outside.warnings.join(),/没有有效相交/);
});
test('rotation and placement preserve volume and move the solid bounds',()=>{
 const box=newComponent('box');box.values={L:60,W:20,H:10};box.rotation=[0,90,0];box.position=[15,25,35];const r=evaluate(state(box));near(r.volume,12000,1e-10);for(let i=0;i<3;i++){near(r.bounds.min[i],[15,15,5][i],1e-9);near(r.bounds.max[i],[25,35,65][i],1e-9);}
});
test('linear material arrays and circular hole arrays use transformed solids',()=>{
 const c=newComponent('box');c.values={L:20,W:20,H:10};c.array.type='line';c.array.count=3;c.array.step=[15,0,0];near(evaluate(state(c)).volume,50*20*10,1e-9);
 const plate=newComponent('cylinder','plate');plate.values={D:200,H:15};const h=newComponent('cylinder','hole');h.operation='cut';h.values={D:12,H:17};h.position=[0,0,-1];h.array={type:'circle',count:4,radius:75,angle:45,step:[0,0,0]};const r=evaluate(state(plate,h));near(r.volume,Math.PI*100**2*15-4*Math.PI*6**2*15);assert.equal(r.components,1);
});
test('custom profiles reject intersections and preserve exact simple sections',()=>{
 for(const p of ['0,0\n10,10\n0,10\n10,0','0,0\n10,0\n0,0','0,0\n2,0\n1,0','0,0\nno,1\n2,2'])assert.throws(()=>parseProfile(p));
 assert.throws(()=>parseProfile('-1,0\n10,0\n10,10',true));
 const p=newComponent('extrude');p.profile='0,0\n30,0\n0,20';p.values.H=5;near(evaluate(state(p)).volume,1500,1e-10);
 const r=newComponent('revolve');r.profile='10,0\n20,0\n20,30\n10,30';near(evaluate(state(r)).volume,Math.PI*(20**2-10**2)*30);
});
test('custom component state survives JSON round trip including disabled parts and arrays',()=>{
 const c=newComponent('conetube','tube');c.position=[10,-20,0];c.rotation=[15,20,-30];c.array.type='line';c.array.count=2;c.array.step=[40,0,0];const ignored=newComponent('sphere','off');ignored.enabled=false;
 const s=state(c,ignored),loaded=normalize(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);near(evaluate(s).volume,evaluate(loaded).volume,1e-10);
});
test('invalid custom projects cannot silently drop dimensions or accept only cuts',()=>{
 for(const mutate of [s=>s.components[0].values.D=NaN,s=>s.components[0].rotation[0]=Infinity,s=>s.components[0].operation='unknown',s=>s.components.push(structuredClone(s.components[0])),s=>s.components[0].array.count=2.5]){const s=fresh('custom');mutate(s);assert.throws(()=>buildDesign(s));}
 const h=newComponent('box');h.operation='cut';assert.throws(()=>evaluate(state(h)),/至少添加/);
 const b=newComponent('box','body');const cut=structuredClone(b);cut.id='cut';cut.operation='cut';assert.throws(()=>evaluate(state(b,cut)),/有效的闭合实体/);
 const tooMany=Array.from({length:5},(_,i)=>{const c=newComponent('box','part-'+i);c.array.type='line';c.array.count=32;return c;});assert.throws(()=>buildDesign(state(...tooMany)),/128/);
});
test('STL contains the final casting while red subtractors remain preview-only',()=>{
 const b=newComponent('box','body');b.values={L:100,W:100,H:20};const h=newComponent('cylinder','hole');h.operation='cut';h.values={D:30,H:24};h.position[2]=-2;
 const r=evaluate(state(b,h),true);assert.equal(r.tools.length,1);const v=new DataView(stlBinary(r.mesh));let volume=0;
 for(let i=0;i<v.getUint32(80,true);i++){const p=Array.from({length:9},(_,k)=>v.getFloat32(84+50*i+12+k*4,true));volume+=(p[0]*(p[4]*p[8]-p[5]*p[7])+p[1]*(p[5]*p[6]-p[3]*p[8])+p[2]*(p[3]*p[7]-p[4]*p[6]))/6;}near(volume,r.volume,1e-6);
});
test('endcap catalog exposes B3 and B5 while old plans retain their geometry',()=>{
 assert.deepEqual(FAMILIES.endcap.variants.map(v=>v[0]),['b3','b5']);assert.ok(!FAMILIES.ring);assert.ok(FAMILIES.custom);
 for(const variant of ['bowl','cone','flat']){const s=fresh('endcap',variant);near(evaluate(normalize(JSON.parse(JSON.stringify(s)))).volume,evaluate(s).volume,1e-9);}
 for(const variant of ['ring','flange','cone'])assert.ok(evaluate(fresh('ring',variant)).volume>0);
});
test('B5 flange sits at the closed face and has independent flange dimensions',()=>{
 const b3=fresh('endcap','b3'),b5=fresh('endcap','b5');const a=evaluate(b3),b=evaluate(b5);assert.ok(b.volume>a.volume);assert.ok(!a.parts.some(p=>p.id==='mountFlange'));
 const flange=buildDesign(b5).groups.find(g=>g.id==='mountFlange');assert.equal(flange.shape.position[2],0);b5.overrides.mountFlangeD=260;assert.ok(evaluate(b5).volume>b.volume);
 assert.ok(!activeOptions(b3).some(o=>['flange','pilot','flangeHoles'].includes(o[0])));
});
test('B5 pilot and cast flange holes respect total depth and material volume',()=>{
 const s=fresh('endcap','b5');s.features.pilot=true;s.overrides.pilotH=3;const solid=evaluate(s);near(solid.bounds.min[2],0,1e-9);near(solid.bounds.max[2],s.values.H,1e-9);
 s.features.flangeHoles=true;const drilled=evaluate(s);assert.ok(drilled.volume<solid.volume);assert.equal(drilled.components,1);
 s.overrides.pilotH=50;assert.throws(()=>evaluate(s),/定位止口/);
});
