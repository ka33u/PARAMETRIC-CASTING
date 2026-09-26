import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {fresh,FAMILIES,normalize,buildDesign,primaryFields,activeOptions} from '../parametric/catalog.mjs';
import {evaluateDesign,stlBinary} from '../parametric/solid.mjs';
const wasm=await Module();wasm.setup();
const evaluate=s=>evaluateDesign(wasm,s,{includeMesh:false});
const near=(a,b,t=.00011)=>assert.ok(Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*t),`${a} vs ${b}`);
for(const [family,f] of Object.entries(FAMILIES))for(const [variant] of f.variants)test(`${family}/${variant}: connected solid and reconciled parts`,()=>{const s=fresh(family,variant),r=evaluate(s);assert.ok(primaryFields(s).length<=5);assert.ok(r.volume>0);assert.equal(r.components,1);near(r.parts.reduce((sum,p)=>sum+p.volume,0),r.volume,1e-7);});
test('annulus and solid cylinder agree with analytic volume',()=>{const s=fresh('ring');for(const bore of [0,80,149]){s.values.bore=bore;near(evaluate(s).volume,Math.PI/4*(150**2-bore**2)*30);}});
test('solid and hollow cone agree with analytic frustum volume',()=>{for(const bore of [0,80]){const s=fresh('ring','cone');s.values.bore=bore;const d=buildDesign(s),D2=d.details.find(x=>x.key==='endD').value,B2=d.details.find(x=>x.key==='endBore').value;near(evaluate(s).volume,Math.PI*s.values.H/12*(s.values.D**2+s.values.D*D2+D2**2-bore**2-bore*B2-B2**2));}});
test('box bottom and open shell match exact rectangular formula',()=>{const s=fresh('box');s.features.lugs=0;for(const bottom of [true,false]){s.features.bottom=bottom;const {L,W,H,t}=s.values;near(evaluate(s).volume,L*W*H-(L-2*t)*(W-2*t)*(H-(bottom?t:0)),1e-10);}});
test('foot and balance block exact volumes',()=>{for(const v of ['foot','weight']){const s=fresh('bracket',v);near(evaluate(s).volume,s.values.L*s.values.W*(v==='foot'?s.values.t:s.values.H),1e-10);}});
test('intersecting hub is unioned; bore removes only material',()=>{const s=fresh('bearing');const d=buildDesign(s),hd=d.details.find(x=>x.key==='hubD').value;near(evaluate(s).volume,Math.PI/4*((s.values.D**2-s.values.bore**2)*s.values.t+(hd**2-s.values.bore**2)*(s.values.H-s.values.t)));});
test('cast holes reduce mass for all families with matching option',()=>{for(const family of Object.keys(FAMILIES)){const s=fresh(family,family==='ring'?'flange':undefined);const before=evaluate(s).volume;s.features.holes=true;const after=evaluate(s).volume;assert.ok(after<before,family);assert.ok(after>before*.7,family);}});
test('wall thickness increases body mass with features disabled',()=>{const s=fresh('motor','plain');s.features.feet=false;s.features.flange=false;const before=evaluate(s).volume;s.values.t+=2;assert.ok(evaluate(s).volume>before);});
test('linked details follow dimensions, overrides stay fixed, reset restores linkage',()=>{const s=fresh('endcap');const get=()=>buildDesign(s).details.find(x=>x.key==='earWidth');assert.equal(get().value,27);s.values.D=240;assert.equal(get().value,36);s.overrides.earWidth=32;s.values.D=260;assert.equal(get().value,32);assert.equal(get().overridden,true);delete s.overrides.earWidth;assert.equal(get().value,39);});
test('default details adapt to shallow but valid main dimensions',()=>{const s=fresh('endcap');s.values.H=8;const r=evaluate(s);assert.ok(r.volume>0);assert.equal(r.details.find(x=>x.key==='earT').value,8);});
test('invalid inputs cannot return stale or nonfinite result',()=>{for(const val of [null,NaN,Infinity,-1,'180']){const s=fresh();s.values.D=val;assert.throws(()=>evaluate(s));}const s=fresh('ring');s.values.bore=s.values.D;assert.throws(()=>evaluate(s),/内径/);const b=fresh('bearing','stepped');b.overrides.stepH=b.values.H;assert.throws(()=>evaluate(b),/第二级/);const m=fresh('motor','rings');m.overrides.finCount=64;assert.throws(()=>evaluate(m),/环筋/);});
test('inactive overrides do not alter mass; malformed projects reject',()=>{const s=fresh('ring');s.overrides.foo=23;near(evaluate(s).volume,evaluate(fresh('ring')).volume,0);assert.match(buildDesign(s).warnings.join(),/未启用/);assert.throws(()=>normalize({format:'unknown'}));const bad=fresh();bad.features.ears=2;assert.throws(()=>normalize(bad));});
test('save/import round trip preserves model, source flags and mass',()=>{const s=fresh('motor');s.values.D=250;s.edited=['D'];s.overrides.finCount=32;s.features.terminal=true;s.name='QA / 机座';s.quantity=7;s.density=7.1;const loaded=normalize(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);near(evaluate(loaded).volume,evaluate(s).volume,0);});
for(const family of ['motor','watercool'])test(`${family}: STL signed volume agrees with casting only`,()=>{const r=evaluateDesign(wasm,fresh(family)),buffer=stlBinary(r.mesh),view=new DataView(buffer),n=view.getUint32(80,true);assert.equal(n,r.triangles);assert.equal(buffer.byteLength,84+n*50);let volume=0;for(let i=0;i<n;i++){const v=Array.from({length:9},(_,k)=>view.getFloat32(84+i*50+12+k*4,true));volume+=(v[0]*(v[4]*v[8]-v[5]*v[7])+v[1]*(v[5]*v[6]-v[3]*v[8])+v[2]*(v[3]*v[7]-v[4]*v[6]))/6;}near(volume,r.volume,1e-6);});

test('water-cooled housing replaces the last category; saved legacy plans still load',()=>{assert.deepEqual(Object.keys(FAMILIES),['endcap','motor','bearing','ring','box','watercool']);assert.equal(primaryFields(fresh('watercool')).length,5);const old=normalize(JSON.parse(JSON.stringify(fresh('bracket'))));assert.ok(evaluate(old).volume>0);});
test('annular water jacket matches analytic metal and empty volumes',()=>{const s=fresh('watercool');s.features.feet=false;s.features.ports=0;const r=evaluate(s),{D,bore,L,t,outerT}=s.values,seal=r.details.find(d=>d.key==='sealT').value;const empty=Math.PI*((D/2-outerT)**2-(bore/2+t)**2)*(L-2*seal);near(r.water.volume,empty);near(r.volume,Math.PI/4*(D**2-bore**2)*L-empty);assert.equal(r.components,1,'an enclosed cavity is not a disconnected casting');assert.equal(r.water.components,1);});
test('water cavity and metal conserve total envelope through different baffles',()=>{const base=fresh('watercool');base.features.feet=false;base.features.ports=0;const plain=evaluate(base);for(const variant of ['axial','rings']){const s={...structuredClone(base),variant},r=evaluate(s);assert.ok(r.volume>plain.volume);assert.ok(r.water.volume<plain.water.volume);near(r.volume+r.water.volume,plain.volume+plain.water.volume,1e-8);assert.equal(r.water.components,1);}});
test('thicker inner and outer walls reduce water volume and increase casting mass',()=>{const s=fresh('watercool');s.features.feet=false;s.features.ports=0;s.overrides.sealT=12;const base=evaluate(s);for(const k of ['t','outerT']){const next=structuredClone(s);next.values[k]+=2;const r=evaluate(next);assert.ok(r.water.volume<base.water.volume);assert.ok(r.volume>base.volume);near(r.water.volume+r.volume,base.water.volume+base.volume,1e-8);}});
test('cast water ports remove material without drilling through inner cylinder',()=>{const s=fresh('watercool');const solid=evaluate(s);s.features.ports=2;const drilled=evaluate(s);assert.ok(drilled.volume<solid.volume);near(drilled.parts.find(p=>p.id==='inner').volume,solid.parts.find(p=>p.id==='inner').volume,1e-9);near(drilled.water.volume,solid.water.volume,1e-9);assert.equal(drilled.components,1);});
test('water jacket feet and flanges never fill its cavity',()=>{for(const variant of ['annular','axial','rings']){const s=fresh('watercool',variant);s.features.feet=false;s.features.ports=0;const bare=evaluate(s);s.features.feet=true;s.features.flange=true;s.features.holes=true;const extra=evaluate(s);near(extra.water.volume,bare.water.volume,1e-8);assert.ok(extra.volume>bare.volume);assert.equal(extra.components,1);}});
test('water jacket blocks impossible thickness and invalid baffles',()=>{const s=fresh('watercool');s.values.bore=280;assert.throws(()=>evaluate(s),/水套没有足够空间/);s.values.bore=230;s.overrides.sealT=160;assert.throws(()=>evaluate(s),/封水环/);delete s.overrides.sealT;s.variant='axial';s.overrides.baffleCount=2.5;assert.throws(()=>evaluate(s),/整数/);});
test('water-cooled plan round trip preserves baffles, ports and both volumes',()=>{const s=fresh('watercool','rings');s.features.ports=2;s.overrides.ringCount=5;s.overrides.windowAngle=70;s.values.L=420;s.edited=['L'];const r=evaluate(s),loaded=normalize(JSON.parse(JSON.stringify(s))),r2=evaluate(loaded);assert.deepEqual(s,loaded);near(r.volume,r2.volume,0);near(r.water.volume,r2.water.volume,0);});

test('unused mounting-hole controls disappear without dropping stored settings',()=>{for(const family of ['motor','watercool']){const s=fresh(family);s.features.holes=true;s.features.feet=false;assert.ok(!activeOptions(s).some(x=>x[0]==='holes'));s.features.feet=true;assert.ok(activeOptions(s).some(x=>x[0]==='holes'));assert.equal(s.features.holes,true);}});
test('more axial baffles automatically reduce default port diameter to avoid collision',()=>{const s=fresh('watercool','axial');s.overrides.baffleCount=32;const r=evaluate(s);assert.equal(r.components,1);assert.ok(r.details.find(x=>x.key==='portD').value<39);});

for(const variant of ['annular','axial','rings'])test(`${variant}: two flange widths change only their own end and preserve the water jacket`,()=>{
 const s=fresh('watercool',variant);s.features.feet=false;s.features.ports=0;const bare=evaluate(s);
 s.features.flange=true;s.overrides={flangeAWidth:20,flangeBWidth:35,flangeWidth:21};const first=evaluate(s),area=Math.PI*((s.values.D/2+21)**2-(s.values.D/2)**2);
 near(first.volume-bare.volume,area*55);near(first.water.volume,bare.water.volume,1e-9);
 near(first.parts.find(p=>p.id==='flangeA').volume,area*20);near(first.parts.find(p=>p.id==='flangeB').volume,area*35);
 assert.equal(first.bounds.min[2],0);assert.equal(first.bounds.max[2],s.values.L);
 s.overrides.flangeAWidth=45;const second=evaluate(s);near(second.volume-first.volume,area*25);near(second.parts.find(p=>p.id==='flangeB').volume,first.parts.find(p=>p.id==='flangeB').volume,1e-9);
 near(second.water.volume,first.water.volume,1e-9);assert.equal(second.components,1);near(second.parts.reduce((v,p)=>v+p.volume,0),second.volume,1e-8);
});
test('legacy shared water flange thickness migrates to independent ends without changing other families',()=>{
 const s=fresh('watercool');s.features.flange=true;s.features.feet=false;s.features.ports=0;s.overrides={flangeT:9,flangeWidth:18};
 const loaded=normalize(s);assert.deepEqual(loaded.overrides,{flangeWidth:18,flangeAWidth:9,flangeBWidth:9});assert.equal(s.overrides.flangeT,9,'import source stays intact');
 const bare=structuredClone(s);bare.features.flange=false;near(evaluate(loaded).volume-evaluate(bare).volume,Math.PI*(168**2-150**2)*18);
 s.overrides.flangeAWidth=20;assert.equal(normalize(s).overrides.flangeAWidth,20);assert.equal(normalize(s).overrides.flangeBWidth,9);
 const endcap=fresh('endcap');endcap.overrides.flangeT=9;assert.deepEqual(normalize(endcap).overrides,{flangeT:9});
});
test('flange widths stay independent through save, switching the feature off and restoring one end',()=>{
 const s=fresh('watercool');s.features.flange=true;s.overrides={flangeAWidth:20,flangeBWidth:35};const loaded=normalize(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);
 const r=evaluate(loaded);loaded.features.flange=false;assert.ok(evaluate(loaded).volume<r.volume);loaded.features.flange=true;near(evaluate(loaded).volume,r.volume,0);
 delete loaded.overrides.flangeAWidth;const details=buildDesign(loaded).details;assert.equal(details.find(d=>d.key==='flangeAWidth').value,12);assert.equal(details.find(d=>d.key==='flangeBWidth').value,35);
});
test('flange widths cannot exceed the total length and may meet without double-counting',()=>{
 const s=fresh('watercool');s.features.feet=false;s.features.ports=0;s.features.flange=true;
 for(const width of [0,300]){s.overrides={flangeAWidth:width};assert.throws(()=>buildDesign(s),/A 端法兰/);}
 s.overrides={flangeAWidth:200,flangeBWidth:101};assert.throws(()=>buildDesign(s),/宽度之和不能超过机座总长/);
 s.overrides={flangeAWidth:.5,flangeBWidth:299.5};const full=evaluate(s);s.features.flange=false;near(full.volume-evaluate(s).volume,Math.PI*(171**2-150**2)*300);assert.equal(full.components,1);
});
