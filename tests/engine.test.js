const assert=require('node:assert/strict');
const test=require('node:test');
const E=require('../dist/engine.js');
const s=(z,h,D0,d0=0,D1=D0,d1=d0,op='add')=>({z,h,D0,d0,D1,d1,op});
const m=segments=>({density:7.2,quantity:1,segments,corrections:[]});
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('solid cylinder and mm³ / g/cm³ to kg conversion',()=>{const r=E.calculate(m([s(0,100,100)]));assert.ok(r.valid);near(r.volume,Math.PI*250000);near(r.weight,Math.PI*1.8);});
test('annulus and batch mass',()=>{const x=m([s(0,30,150,80)]);x.quantity=250;const r=E.calculate(x);near(r.volume,Math.PI/4*(150**2-80**2)*30);near(r.total,r.weight*250);});
test('hollow frustum and cone apex',()=>{near(E.calculate(m([s(0,80,160,120,100,60)])).volume,Math.PI*80/12*((160**2+160*100+100**2)-(120**2+120*60+60**2)));near(E.calculate(m([s(0,90,60,0,0,0)])).volume,Math.PI*30**2*90/3);});
test('overlapping bodies are a union, not an addition',()=>{const r=E.calculate(m([s(0,100,100),s(30,20,100)]));near(r.volume,Math.PI*250000);near(r.overlap,Math.PI*2500*20);});
test('overlapping cuts counted once and only intersecting part removed',()=>{const r=E.calculate(m([s(0,50,100),s(10,80,60,0,60,0,'cut'),s(20,10,60,0,60,0,'cut')]));near(r.volume,Math.PI*(2500*50-900*40));});
test('cut outside radial or axial material removes nothing',()=>{const r=E.calculate(m([s(0,20,100,80),s(0,20,50,0,50,0,'cut'),s(30,10,200,0,200,0,'cut')]));near(r.volume,Math.PI*(2500-1600)*20);});
test('multiple separated radial bands remain hollow',()=>{const r=E.calculate(m([s(0,20,40,20),s(0,20,100,80)]));near(r.volume,Math.PI*(400-100+2500-1600)*20);});
test('crossing conical walls split at their exact intersection',()=>{const r=E.calculate(m([s(0,100,40,0,120),s(0,100,120,0,40)]));near(r.volume,2*Math.PI*50/3*(60**2+60*40+40**2));});
test('radial cut whose conical boundary crosses the body',()=>{const r=E.calculate(m([s(0,100,100),s(0,100,0,0,200,0,'cut')]));near(r.volume,Math.PI*2500*50-Math.PI*50**3/3);});
test('ribs, off-axis holes and manual volume correction',()=>{const x=m([s(0,100,100)]);x.corrections=[{type:'box',op:'add',a:20,b:30,c:4,count:3},{type:'hole',op:'cut',a:10,b:20,count:6},{type:'volume',op:'cut',a:2,count:1}];const r=E.calculate(x);near(r.volume,Math.PI*250000+7200-Math.PI*25*20*6-2000);});
test('empty, negative, invalid, no material and over-subtraction rejected',()=>{for(const x of [m([]),m([s(0,0,100)]),m([s(0,10,20,30)]),m([s(0,10,NaN)]),m([s(0,10,100,0,100,0,'cut')]),{...m([s(0,10,100)]),density:0},{...m([s(0,10,100)]),quantity:1.5},{...m([s(0,10,100)]),corrections:[{type:'volume',op:'cut',a:999999,count:1}]}])assert.equal(E.calculate(x).valid,false);});
test('independent numerical union/difference integration over randomized geometry',()=>{
 let seed=7321;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(let trial=0;trial<12;trial++){
  const list=[s(0,100,180,20)];for(let i=0;i<5;i++){const D0=30+rand()*170,D1=30+rand()*170;list.push(s(rand()*60,10+rand()*30,D0,rand()*D0*.6,D1,rand()*D1*.6,i%2?'cut':'add'));}
  const r=E.calculate(m(list));assert.ok(r.valid);let volume=0;const dz=.005;
  // Independent cross-section oracle: partition all radial boundaries and test material membership.
  for(let z=dz/2;z<100;z+=dz){const active=list.filter(x=>z>=x.z&&z<x.z+x.h).map(x=>{const t=(z-x.z)/x.h;return {lo:(x.d0*(1-t)+x.d1*t)/2,hi:(x.D0*(1-t)+x.D1*t)/2,op:x.op};});const cuts=[...new Set(active.flatMap(x=>[x.lo,x.hi]))].sort((a,b)=>a-b);for(let j=1;j<cuts.length;j++){const mid=(cuts[j-1]+cuts[j])/2;const covered=active.filter(x=>mid>x.lo&&mid<x.hi);if(covered.some(x=>x.op==='add')&&!covered.some(x=>x.op==='cut'))volume+=Math.PI*(cuts[j]**2-cuts[j-1]**2)*dz;}}
  near(r.volume,volume,0.0002);
 }
});
test('axial offset leaves tapered volume unchanged',()=>{const a=E.calculate(m([s(0,60,100,40,50,20)]));const b=E.calculate(m([s(37,60,100,40,50,20)]));near(a.volume,b.volume);near(b.geometry[0].R0,50);near(b.geometry.at(-1).R1,25);});
