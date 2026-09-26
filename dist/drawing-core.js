(function(root){
'use strict';
function parseDimensions(input,basis='毛坯尺寸'){
 const items=typeof input==='string'?input.split(/\n+/).map(text=>({text})):input;
 const candidates=[];
 for(const [index,item] of items.entries()){
  const text=String(item.text||'').normalize('NFKC').replace(/[（）]/g,m=>m==='（'?'(':')');
  if(/(?:Ra\s*\d|\bM\s*\d)/i.test(text)&&!/[φΦØø⌀]/.test(text))continue;
  const re=/(?:(\d+)\s*[-×x]\s*)?([φΦØø⌀RrPp$]?)\s*(\d+(?:\.\d+)?)(?:\s*\(\s*[φΦØø⌀Pp$]?\s*(\d+(?:\.\d+)?)\s*\))?/g;
  for(const m of text.matchAll(re)){
   const before=text.slice(0,m.index);if(/[±+−-]\s*$/.test(before))continue;
   const cast=Number(m[3]),finished=m[4]===undefined?null:Number(m[4]);
   if(cast<=0||cast>1e6)continue;
   const ambiguous=/[Pp$]/.test(m[2])||/^0\d/.test(m[3]);
   const kind=/[φΦØø⌀]/.test(m[2])?'直径':/[Rr]/.test(m[2])?'半径':ambiguous?'符号待核':'尺寸';
   candidates.push({raw:m[0].trim(),cast,finished,value:basis==='加工后尺寸'&&finished!==null?finished:cast,kind,count:m[1]?Number(m[1]):null,ambiguous,confidence:item.confidence??null,itemIndex:index,box:item.x===undefined?null:{x:item.x,y:item.y,width:item.width,height:item.height}});
  }
 }
 const values={D:[],d:[],H:[]};
 for(const item of items){
  const text=String(item.text||'').normalize('NFKC');
  if(/\b(?:cm|inch)\b|厘米|英寸/i.test(text))continue;
  for(const m of text.matchAll(/(外径|内径|总长|长度|高度|厚度)\s*[:=：]?\s*[φΦØø⌀]?\s*(\d+(?:\.\d+)?)(?:\s*\(\s*[φΦØø⌀]?\s*(\d+(?:\.\d+)?)\s*\))?/g)){
   const key=m[1]==='外径'?'D':m[1]==='内径'?'d':'H';values[key].push(Number(basis==='加工后尺寸'&&m[3]!==undefined?m[3]:m[2]));
  }
 }
 const draft={};for(const k of Object.keys(values)){const unique=[...new Set(values[k])];if(unique.length===1)draft[k]=unique[0];}
 return {candidates,draft};
}
function traceToProfile(outline,axis,calibration,distance){
 if(axis.length!==2||calibration.length!==2||outline.length<3)throw new Error('请先标定比例、设置旋转轴，并至少描出三个轮廓点。');
 if(!Number.isFinite(distance)||distance<=0)throw new Error('标定距离必须大于 0。');
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 if(dist(...axis)<2||dist(...calibration)<2)throw new Error('两次点击太近，请重新选点。');
 const scale=distance/dist(...calibration),a=axis[0],b=axis[1],len=dist(a,b),u={x:(b.x-a.x)/len,y:(b.y-a.y)/len};
 const transformed=outline.map(p=>({r:((p.x-a.x)*u.y-(p.y-a.y)*u.x)*scale,z:((p.x-a.x)*u.x+(p.y-a.y)*u.y)*scale}));
 const tolerance=scale*.5;
 if(transformed.some(p=>p.r>tolerance)&&transformed.some(p=>p.r<-tolerance))throw new Error('轮廓跨过旋转轴，请只描轴线一侧的材料。');
 if(transformed.some(p=>p.z<-tolerance))throw new Error('轮廓位于 Z 原点反向；请将旋转轴第一点放在截面起端之前，并沿 Z 正向选第二点。');
 return transformed.map(p=>[Math.abs(p.r)<tolerance?0:Math.abs(p.r),Math.max(0,p.z)]);
}
const api={parseDimensions,traceToProfile};root.DrawingCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
