/* Exact axisymmetric union/difference. All geometry in mm; volume in mm³. */
(function(root){
'use strict';
const EPS=1e-9;
const num=x=>typeof x==='number' && Number.isFinite(x);
const line=(v0,v1,z,h)=>({a:(v1-v0)/h,b:v0-(v1-v0)*z/h});
const at=(l,z)=>l.a*z+l.b;
// Fields, validation and formulas share one catalogue with the visible editor.
const SHAPES={
 box:{name:'方块 / 底脚 / 凸台',fields:[['a','长度'],['b','宽度'],['c','高度']],defaults:{a:80,b:45,c:15},formula:'L × W × H',volume:c=>c.a*c.b*c.c},
 fin:{name:'梯形散热筋 / 加强筋',fields:[['a','长度'],['b','径向高度'],['c','根部厚度'],['d','顶部厚度']],defaults:{a:160,b:20,c:5,d:3},zero:['d'],formula:'长度 × 高度 × (根厚 + 顶厚) / 2',volume:c=>c.a*c.b*(c.c+c.d)/2},
 triangle:{name:'三角筋板',fields:[['a','底边'],['b','高度'],['c','厚度']],defaults:{a:40,b:30,c:6},formula:'底边 × 高度 × 厚度 / 2',volume:c=>c.a*c.b*c.c/2},
 hole:{name:'圆孔 / 螺栓孔 / 圆柱凸台',fields:[['a','直径'],['b','深度 / 长度']],defaults:{a:12,b:20},formula:'π × D² × 深度 / 4',volume:c=>Math.PI*c.a*c.a*c.b/4},
 coneHole:{name:'锥孔 / 沉头孔',fields:[['a','起端直径'],['b','末端直径'],['c','深度']],defaults:{a:20,b:10,c:8},zero:['b'],formula:'π × 深度 × (D₀² + D₀D₁ + D₁²) / 12',volume:c=>Math.PI*c.c*(c.a*c.a+c.a*c.b+c.b*c.b)/12},
 slot:{name:'腰形孔 / 长圆槽',fields:[['a','总长'],['b','宽度'],['c','深度']],defaults:{a:35,b:12,c:15},formula:'[(总长 − 宽度) × 宽度 + π × 宽度² / 4] × 深度',volume:c=>((c.a-c.b)*c.b+Math.PI*c.b*c.b/4)*c.c,check:c=>c.a<c.b?'腰形孔总长不能小于宽度。':null},
 tube:{name:'偏心圆管 / 环形凸台',fields:[['a','外径'],['b','内径'],['c','长度']],defaults:{a:60,b:40,c:20},zero:['b'],formula:'π × (外径² − 内径²) × 长度 / 4',volume:c=>Math.PI*(c.a*c.a-c.b*c.b)*c.c/4,check:c=>c.b>=c.a?'圆管内径应小于外径。':null},
 sector:{name:'圆环扇段 / 弧形筋',fields:[['a','外径'],['b','内径'],['c','厚度'],['d','圆心角','°']],defaults:{a:180,b:160,c:10,d:90},zero:['b'],formula:'π × (外径² − 内径²) × 厚度 × 圆心角 / 1440',volume:c=>Math.PI*(c.a*c.a-c.b*c.b)*c.c*c.d/1440,check:c=>c.b>=c.a||c.d>360?'扇段内径应小于外径，圆心角不超过 360°。':null},
 roundedBox:{name:'圆角矩形凸台 / 槽',fields:[['a','长度'],['b','宽度'],['c','高度'],['d','平面圆角 R']],defaults:{a:80,b:60,c:15,d:8},zero:['d'],formula:'[L × W − (4 − π) × R²] × H',volume:c=>(c.a*c.b-(4-Math.PI)*c.d*c.d)*c.c,check:c=>2*c.d>Math.min(c.a,c.b)?'平面圆角直径不能超过短边。':null},
 hollowBox:{name:'方形接线盒 / 方框',fields:[['a','外长'],['b','外宽'],['c','高度'],['d','壁厚']],defaults:{a:100,b:80,c:45,d:6},formula:'[L × W − (L − 2t) × (W − 2t)] × H（不含底板）',volume:c=>(c.a*c.b-(c.a-2*c.d)*(c.b-2*c.d))*c.c,check:c=>2*c.d>=Math.min(c.a,c.b)?'壁厚应小于短边的一半。':null},
 sphereCap:{name:'球冠 / 球面凹槽',fields:[['a','球面半径 R'],['b','球冠高度 h']],defaults:{a:100,b:20},formula:'π × h² × (R − h / 3)',volume:c=>Math.PI*c.b*c.b*(c.a-c.b/3),check:c=>c.b>2*c.a?'球冠高度不能超过球面直径。':null},
 torus:{name:'圆截面环 / 环槽',fields:[['a','中心圆半径'],['b','截面半径'],['c','扫掠角','°']],defaults:{a:70,b:4,c:360},formula:'2π² × 中心圆半径 × 截面半径² × 角度 / 360',volume:c=>2*Math.PI**2*c.a*c.b*c.b*c.c/360,check:c=>c.b>c.a||c.c>360?'截面半径不能超过中心圆半径，角度不超过 360°。':null},
 fillet:{name:'直边圆角增减',fields:[['a','圆角半径 R'],['b','边长']],defaults:{a:3,b:100},formula:'(1 − π / 4) × R² × 边长；仅适用直边 90° 圆角',volume:c=>(1-Math.PI/4)*c.a*c.a*c.b},
 volume:{name:'其他净体积',fields:[['a','净体积','cm³']],defaults:{a:10},formula:'手填净体积',volume:c=>c.a*1000}
};
function validate(model){
 const errors=[];
 if(!num(model.density)||model.density<=0||model.density>30) errors.push('密度应大于 0 且不超过 30 g/cm³。');
 if(!Number.isSafeInteger(model.quantity)||model.quantity<1||model.quantity>1000000000) errors.push('数量应为 1 至 10 亿的整数。');
 if(!Array.isArray(model.segments)||(!model.segments.length&&!(model.corrections||[]).length)) errors.push('请至少添加一个回转段或局部结构。');
 if((model.segments||[]).length>600) errors.push('回转段最多为 600 段。');
 for(const [i,s] of (model.segments||[]).entries()){
  const n=`第 ${i+1} 段`;
  if(!['add','cut'].includes(s.op)) errors.push(`${n}的计算方式无效。`);
  if(!['z','h','D0','D1','d0','d1'].every(k=>num(s[k]))) {errors.push(`${n}有尺寸未填写或不是有效数字。`);continue;}
  if(s.z<0||s.z>1e6||s.h<=0||s.h>1e6) errors.push(`${n}的起点应为 0～1000000，高度应大于 0 且不超过 1000000 mm。`);
  if(Math.min(s.D0,s.D1,s.d0,s.d1)<0||Math.max(s.D0,s.D1)>1e6) errors.push(`${n}的直径应为 0～1000000 mm。`);
  if(s.d0>s.D0||s.d1>s.D1||(s.d0===s.D0&&s.d1===s.D1)) errors.push(`${n}的内径不能大于外径，且不能两端都没有壁厚。`);
 }
 for(const [i,c] of (model.corrections||[]).entries()){
  const shape=SHAPES[c.type];
  if(!shape||!['add','cut'].includes(c.op)) {errors.push(`局部结构 ${i+1} 的类型无效。`);continue;}
  if(!Number.isSafeInteger(c.count)||c.count<1||c.count>1000000) errors.push(`修正项 ${i+1} 的数量应为 1～1000000 的整数。`);
  const keys=shape.fields.map(f=>f[0]);
  if(keys.some(k=>!num(c[k])||c[k]>1e9||((shape.zero||[]).includes(k)?c[k]<0:c[k]<=0))) errors.push(`局部结构 ${i+1} 的尺寸或体积无效。`);
  const detail=shape.check?.(c);if(detail)errors.push(`局部结构 ${i+1}：${detail}`);
 }
 return errors;
}
function prepare(segments){return segments.map(s=>({...s,lo:line(s.d0/2,s.d1/2,s.z,s.h),hi:line(s.D0/2,s.D1/2,s.z,s.h)}));}
function merge(ranges,z){
 const arr=ranges.filter(r=>at(r[1],z)-at(r[0],z)>EPS).sort((a,b)=>at(a[0],z)-at(b[0],z));
 const out=[];
 for(const r of arr){const last=out[out.length-1]; if(last&&at(r[0],z)<=at(last[1],z)+EPS){if(at(r[1],z)>at(last[1],z))last[1]=r[1];}else out.push([...r]);}
 return out;
}
function radial(prepared,z,onlyAdd=false){
 const active=prepared.filter(s=>z>s.z-EPS&&z<s.z+s.h+EPS);
 let ranges=merge(active.filter(s=>s.op==='add').map(s=>[s.lo,s.hi]),z);
 if(onlyAdd)return ranges;
 const cuts=merge(active.filter(s=>s.op==='cut').map(s=>[s.lo,s.hi]),z);
 for(const c of cuts){const next=[]; for(const r of ranges){
  if(at(c[1],z)<=at(r[0],z)||at(c[0],z)>=at(r[1],z)){next.push(r);continue;}
  if(at(c[0],z)>at(r[0],z)) next.push([r[0],c[0]]);
  if(at(c[1],z)<at(r[1],z)) next.push([c[1],r[1]]);
 }ranges=next;}
 return ranges;
}
function slabs(segments,onlyAdd=false){
 const p=prepare(segments), points=p.flatMap(s=>[s.z,s.z+s.h]);
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  const lo=Math.max(p[i].z,p[j].z),hi=Math.min(p[i].z+p[i].h,p[j].z+p[j].h);
  if(lo>=hi)continue;
  for(const a of [p[i].lo,p[i].hi])for(const b of [p[j].lo,p[j].hi]){
   if(Math.abs(a.a-b.a)<1e-14)continue;
   const z=(b.b-a.b)/(a.a-b.a);if(z>lo+EPS&&z<hi-EPS)points.push(z);
  }
 }
 const sorted=points.sort((a,b)=>a-b).filter((v,i,a)=>!i||Math.abs(v-a[i-1])>EPS);
 const result=[];
 for(let i=1;i<sorted.length;i++){
  const z0=sorted[i-1],z1=sorted[i];
  for(const [lo,hi] of radial(p,(z0+z1)/2,onlyAdd)) result.push({z0,z1,r0:at(lo,z0),r1:at(lo,z1),R0:at(hi,z0),R1:at(hi,z1)});
 }
 return result;
}
const frustum=(r0,r1,h)=>Math.PI*h*(r0*r0+r0*r1+r1*r1)/3;
const slabVolume=s=>frustum(s.R0,s.R1,s.z1-s.z0)-frustum(s.r0,s.r1,s.z1-s.z0);
const segmentVolume=s=>frustum(s.D0/2,s.D1/2,s.h)-frustum(s.d0/2,s.d1/2,s.h);
const correctionVolume=c=>SHAPES[c.type]?SHAPES[c.type].volume(c)*c.count:NaN;
function polygonSegments(points,op='add'){
 if(!Array.isArray(points)||points.length<3||points.length>60||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!num(v)||v<0||v>1e6)))throw new Error('轮廓需要 3～60 个有效 (半径 r, 轴向 Z) 点，坐标不能为负数。');
 const p=points.map(x=>[...x]);if(p.length>3&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1])p.pop();
 const edges=p.map((a,i)=>[a,p[(i+1)%p.length]]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a,b,c)=>Math.abs(cross(a,b,c))<EPS&&c[0]>=Math.min(a[0],b[0])-EPS&&c[0]<=Math.max(a[0],b[0])+EPS&&c[1]>=Math.min(a[1],b[1])-EPS&&c[1]<=Math.max(a[1],b[1])+EPS;
 for(let i=0;i<edges.length;i++){
  const [a,b]=edges[i];if(Math.hypot(a[0]-b[0],a[1]-b[1])<EPS)throw new Error('轮廓存在重复点。');
  for(let j=i+1;j<edges.length;j++){if(j===i+1||(i===0&&j===edges.length-1))continue;
   const [c,d]=edges[j],u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),x=cross(c,d,b);
   if((u*v<0&&w*x<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw new Error('轮廓自交或相接，请按边界顺序描点。');
  }
 }
 const zs=[...new Set(p.map(x=>x[1]))].sort((a,b)=>a-b),out=[];
 for(let i=1;i<zs.length;i++){
  const z0=zs[i-1],z1=zs[i],mid=(z0+z1)/2;
  const hits=edges.filter(([a,b])=>Math.min(a[1],b[1])<mid&&Math.max(a[1],b[1])>mid).map(([a,b])=>line(a[0],b[0],a[1],b[1]-a[1])).sort((a,b)=>at(a,mid)-at(b,mid));
  if(hits.length%2)throw new Error('轮廓未形成有效闭合区域。');
  for(let j=0;j<hits.length;j+=2){const lo=hits[j],hi=hits[j+1];out.push({name:'自定义截面',op,z:z0,h:z1-z0,d0:Math.max(0,2*at(lo,z0)),d1:Math.max(0,2*at(lo,z1)),D0:Math.max(0,2*at(hi,z0)),D1:Math.max(0,2*at(hi,z1))});}
 }
 if(!out.length||out.reduce((v,s)=>v+segmentVolume(s),0)<=EPS)throw new Error('轮廓面积为零。');
 if(out.length>100)throw new Error('轮廓过于复杂，请拆成几块材料区域。');
 return out;
}
function calculate(model){
 const errors=validate(model);if(errors.length)return {valid:false,errors};
 const geometry=slabs(model.segments),rawAdd=model.segments.filter(s=>s.op==='add').reduce((a,s)=>a+segmentVolume(s),0);
 const unionVolume=slabs(model.segments,true).reduce((a,s)=>a+slabVolume(s),0),bodyVolume=geometry.reduce((a,s)=>a+slabVolume(s),0);
 let added=0,removed=0;
 for(const c of model.corrections||[]){if(c.op==='cut')removed+=correctionVolume(c);else added+=correctionVolume(c);}
 const volume=bodyVolume+added-removed;
 if(!Number.isFinite(volume)||volume<=0) return {valid:false,errors:['净体积应大于 0，请检查实体段、扣除段及修正项。']};
 const weight=volume*model.density/1e6;
 return {valid:true,errors:[],geometry,rawAdd,unionVolume,overlap:Math.max(0,rawAdd-unionVolume),cutVolume:Math.max(0,unionVolume-bodyVolume),bodyVolume,added,removed,volume,weight,total:weight*model.quantity};
}
const E={validate,calculate,slabs,segmentVolume,correctionVolume,SHAPES,polygonSegments};
root.CastingEngine=E;if(typeof module!=='undefined')module.exports=E;
})(globalThis);
