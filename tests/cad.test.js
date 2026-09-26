const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/cad-core.js'),E=require('../dist/engine.js');
const square=(a,b)=>[[a,a],[b,a],[b,b],[a,b],[a,a]];
test('hit testing respects holes and disjoint islands',()=>{
 const r={polygons:[{outer:square(0,10),holes:[square(2,4)]},{outer:square(20,21),holes:[]}]};
 assert.equal(C.contains(r,[1,1]),true);assert.equal(C.contains(r,[3,3]),false);assert.equal(C.contains(r,[20.5,20.5]),true);assert.equal(C.contains(r,[15,15]),false);
});
test('native hatch beats drawing frame and overlapping outlines',()=>{
 const regions=[{id:'frame',source:'outline',area:100,polygons:[{outer:square(0,10),holes:[]}]},{id:'material',source:'hatch',area:100,polygons:[{outer:square(0,10),holes:[]}]},{id:'cell',source:'outline',area:4,polygons:[{outer:square(0,2),holes:[]}]}];
 assert.deepEqual(C.hits(regions,[1,1]).map(r=>r.id),['material','cell','frame']);
});
test('side calculation handles rotated and reversed axes',()=>{
 assert.equal(C.sideOf([[0,0],[0,10]],[5,2]),1);assert.equal(C.sideOf([[0,10],[0,0]],[5,2]),-1);assert.equal(C.sideOf([[0,0],[10,0]],[2,5]),-1);
});
test('scale requires two distinct points and a positive known distance',()=>{
 assert.equal(C.calibration([0,0],[3,4],100),20);assert.throws(()=>C.calibration([1,1],[1,1],100));assert.throws(()=>C.calibration([0,0],[1,1],NaN));
});
test('axis selection uses bounded line segments',()=>{
 assert.equal(C.distanceToLine([5,2],[0,0],[10,0]),2);assert.equal(C.distanceToLine([13,4],[0,0],[10,0]),5);
});
test('curved CAD profiles can carry more than 100 integration segments',()=>{
 const segments=Array.from({length:181},(_,i)=>({z:i,h:1,D0:100,D1:100,d0:80,d1:80,op:'add'}));
 const result=E.calculate({density:7.2,quantity:1,segments,corrections:[]});assert.equal(result.valid,true);assert.ok(Math.abs(result.volume-Math.PI*900*181)<1e-6);
 assert.equal(E.calculate({density:7.2,quantity:1,segments:Array(601).fill(segments[0]),corrections:[]}).valid,false);
});
