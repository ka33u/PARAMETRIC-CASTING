import {buildDesign} from './catalog.mjs';

export function evaluateDesign(wasm,state,{segments=256,includeParts=true,includeMesh=true}={}){
 const design=buildDesign(state),M=wasm.Manifold,alive=new Set();
 const keep=obj=>(alive.add(obj),obj);
 function combine(items){return items.length===1?items[0]:keep(M.union(items));}
 function evalNode(n){
  let out;
  switch(n.type){
   case 'box':out=keep(M.cube(n.size));break;
   case 'cylinder':out=keep(M.cylinder(n.h,n.r,n.r2,segments));break;
   case 'sphere':out=keep(M.sphere(n.r,segments));break;
   case 'prism':out=keep(M.extrude([n.points],n.h));break;
   case 'revolve':out=keep(M.revolve([n.points],segments));break;
   case 'union':return combine(n.children.map(evalNode));
   case 'difference':{const [first,...rest]=n.children.map(evalNode);return rest.length?keep(first.subtract(combine(rest))):first;}
   case 'transform':return keep(keep(evalNode(n.body).rotate(n.rotate)).translate(n.translate));
   default:throw Error('不支持的几何类型：'+n.type);
  }
  return n.position?keep(out.translate(n.position)):out;
 }
 function mesh(solid){
  const m=solid.getMesh();
  // numVert is a getter in current Manifold; derive safely for lossless output.
  const positions=m.numProp===3?new Float32Array(m.vertProperties):new Float32Array(m.vertProperties.length/m.numProp*3);
  if(m.numProp!==3)for(let i=0;i<positions.length/3;i++)positions.set(m.vertProperties.subarray(i*m.numProp,i*m.numProp+3),i*3);
  return {positions,indices:new Uint32Array(m.triVerts)};
 }
 try{
  const raw=design.groups.map(g=>evalNode(g.shape)),cutters=design.cuts.map(evalNode),tool=cutters.length?combine(cutters):null;
  const before=combine(raw),solid=tool?keep(before.subtract(tool)):before;
  const volume=solid.volume();if(solid.status()!=='NoError'||!Number.isFinite(volume)||volume<=0)throw Error('这些尺寸未形成有效的闭合实体，请调整尺寸。');
  const components=solid.decompose();components.forEach(keep);
  // A sealed water jacket adds a negatively oriented cavity boundary, not a second casting.
  const materialComponents=components.filter(c=>c.volume()>1e-9).length;
  let water=null;
  if(design.waterBoundary){
   const cavity=keep(evalNode(design.waterBoundary).subtract(solid)),v=cavity.volume();
   if(cavity.status()!=='NoError'||!Number.isFinite(v)||v<=0)throw Error('水套空腔被实体占满，请减小壁厚或隔水筋尺寸。');
   const channels=cavity.decompose();channels.forEach(keep);
   water={...design.waterInfo,volume:v,components:channels.length,mesh:includeMesh?mesh(cavity):null};
  }
  let accumulated=null;const parts=[];
  if(includeParts)for(let i=0;i<raw.length;i++){
   const newPart=accumulated?keep(raw[i].subtract(accumulated)):raw[i];
   accumulated=accumulated?keep(accumulated.add(raw[i])):raw[i];
   const net=tool?keep(newPart.subtract(tool)):newPart,partVolume=net.volume();
   parts.push({id:design.groups[i].id,label:design.groups[i].label,keys:design.groups[i].keys,volume:Math.max(0,partVolume),mesh:includeMesh&&partVolume>1e-8?mesh(net):null});
  }
  if(includeParts&&Math.abs(parts.reduce((a,p)=>a+p.volume,0)-volume)>Math.max(.01,volume*1e-6))throw Error('分项与整体体积校验不一致，请重试。');
  const tools=includeMesh?(design.toolGroups||[]).map((g,i)=>({id:g.id,label:g.label,mesh:mesh(cutters[i])})):[];
  const warnings=[...design.warnings];if(design.state.family==='custom'&&cutters.length&&before.volume()-volume<1e-7)warnings.push('减料体与材料没有有效相交，当前重量未因减料改变；可显示减料体检查位置。');
  return {volume,water,tools,mesh:includeMesh?mesh(solid):null,parts,bounds:solid.boundingBox(),triangles:solid.numTri(),components:materialComponents,details:design.details,warnings,label:design.label,segments,
   removed:before.volume()-volume,state:design.state};
 }finally{for(const obj of [...alive].reverse())obj.delete();}
}

export function stlBinary(mesh){
 const {positions:p,indices:t}=mesh,count=t.length/3,buffer=new ArrayBuffer(84+count*50),view=new DataView(buffer);
 new Uint8Array(buffer,0,80).set(new TextEncoder().encode('Casting parametric solid; dimensions in millimeters'));
 view.setUint32(80,count,true);
 for(let i=0;i<count;i++){
  const points=[0,1,2].map(k=>Array.from(p.subarray(t[i*3+k]*3,t[i*3+k]*3+3)));
  const a=points[1].map((v,j)=>v-points[0][j]),b=points[2].map((v,j)=>v-points[0][j]);
  let n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n);n=n.map(v=>len?v/len:0);
  [...n,...points.flat()].forEach((v,k)=>view.setFloat32(84+i*50+k*4,v,true));
 }
 return buffer;
}
