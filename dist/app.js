'use strict';
const $=s=>document.querySelector(s);
const E=globalThis.CastingEngine;
let nextId=1,view='3d',pitch=.65,yaw=.45,zoom=1,activePreset='motor';
const seg=(name,z,h,D0,d0=0,D1=D0,d1=d0,op='add')=>({id:nextId++,name,z,h,D0,d0,D1,d1,op,cone:D0!==D1||d0!==d1});
const feature=(type,name,values={},count=1,op='add')=>({id:nextId++,type,name,op,count,...E.SHAPES[type].defaults,...values});
const presets={
 motor:()=>({name:'散热筋电机机座',segments:[seg('机座筒体',0,220,220,190),seg('前端止口',0,15,235,190),seg('后端止口',205,15,235,190)],corrections:[feature('fin','轴向散热筋',{a:175,b:20,c:5,d:3},24),feature('box','安装底脚',{a:160,b:45,c:18},2),feature('triangle','底脚加强筋',{a:40,b:35,c:8},4),feature('hole','底脚螺栓孔',{a:14,b:18},4,'cut'),feature('hollowBox','接线盒围壁',{a:100,b:80,c:40,d:6})],note:'通用机座示例：筒体、止口、散热筋、底脚、加强筋、螺栓孔、接线盒。所有尺寸均为演示值。'}),
 bearing:()=>({name:'轴承座端盖',segments:[seg('轴承座外环',0,40,100,52),seg('端面法兰',30,12,180,52),seg('轴承沉孔',0,20,62,0,62,0,'cut')],corrections:[feature('hole','法兰螺栓孔',{a:12,b:12},4,'cut')],note:'中心孔、阶梯沉孔和法兰组合；偏心孔按实际穿过材料的深度扣除。'}),
 bell:()=>({name:'锥形端罩',segments:[seg('安装法兰',0,12,240,190),seg('锥形筒壁',12,70,220,190,120,100),seg('轴承凸台',82,20,120,60)],corrections:[],note:'锥台与法兰、轴承凸台组合。两端直径可表达拔模斜度。'}),
 annular:()=>({name:'环形散热筋机壳',segments:[seg('筒体',0,180,180,160),...Array.from({length:8},(_,i)=>seg('环形散热筋 '+(i+1),10+i*20,5,220,180))],corrections:[],note:'完整散热环计入回转模型；不完整弧段可在局部结构里选择圆环扇段。'}),
 ring:()=>({name:'圆环铸件',segments:[seg('圆环主体',0,30,150,80)],note:'内径填 0 为实心圆柱；内径大于 0 为圆环。'}),
 cone:()=>({name:'锥形套筒',segments:[seg('锥环主体',0,80,160,120,100,60)],note:'起端为 Z 处，末端为 Z + H 处；外径和内径分别线性变化。'}),
 flange:()=>({name:'阶梯法兰',segments:[seg('底部法兰',0,20,180,50),seg('台阶轮毂',20,40,90,50)],note:'沿轴线依次叠加两段圆环。修改起点 Z 可以调整台阶位置。'}),
 cover:()=>({name:'带法兰端盖',segments:[seg('端面',0,7,134,25),seg('中心凸台',7,6,74,25),seg('中心沉孔段',13,23,74,58),seg('筒壁',7,33,134,120),seg('法兰',40,10,167,120),seg('底部止口',50,10,162,146)],note:'参考图风格的简化示例，法兰高度等为演示值；请按完整图纸核对后计算。'})
};
let model={...presets.motor(),density:7.2,quantity:1,basis:'毛坯尺寸',source:'手动参数 / 模板'};
let result=E.calculate(model);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=3)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
function input(label,key,value,id,extra=''){return `<label>${label}<input type="number" inputmode="decimal" step="any" min="0" data-id="${id}" data-key="${key}" aria-label="${esc(label)}" value="${value}" ${extra}></label>`;}
function renderSegments(){
 const rows=model.segments.map((s,i)=>`<article class="segment ${s.op==='cut'?'is-cut':''}" data-segment="${s.id}" aria-label="回转段 ${i+1}"><div class="segment-top"><span class="segment-number">${String(i+1).padStart(2,'0')}</span><input class="segment-name" data-id="${s.id}" data-key="name" value="${esc(s.name)}" aria-label="第 ${i+1} 段名称" maxlength="60"><select data-id="${s.id}" data-key="op" aria-label="第 ${i+1} 段计算方式"><option value="add" ${s.op==='add'?'selected':''}>实体 ＋</option><option value="cut" ${s.op==='cut'?'selected':''}>扣除 −</option></select><button class="delete" data-delete="${s.id}" aria-label="删除第 ${i+1} 段">×</button></div><div class="dimension-grid">${input('起点 Z','z',s.z,s.id)}${input('高度 H','h',s.h,s.id)}${input(s.cone?'起端外径 D₀':'外径 D','D0',s.D0,s.id)}${input(s.cone?'起端内径 d₀':'内径 d','d0',s.d0,s.id)}${s.cone?input('末端外径 D₁','D1',s.D1,s.id)+input('末端内径 d₁','d1',s.d1,s.id):''}</div><div class="segment-foot"><label class="cone-label"><input type="checkbox" data-id="${s.id}" data-key="cone" ${s.cone?'checked':''}>锥台 / 拔模斜度</label><span id="segment-volume-${s.id}"></span></div></article>`).join('');
 $('#segments').innerHTML=model.segments.length>16?`<details class="cad-segment-details"><summary>CAD 积分轮廓 · ${model.segments.length} 段（展开编辑）</summary>${rows}</details>`:rows;
}
function renderCorrections(){
 $('#corrections').innerHTML=model.corrections.map((c,i)=>{const shape=E.SHAPES[c.type];return `<article class="correction-item"><div class="correction-top"><input class="feature-name" data-cid="${c.id}" data-key="name" aria-label="局部结构 ${i+1} 名称" value="${esc(c.name||shape.name)}" maxlength="60"><select data-cid="${c.id}" data-key="op" aria-label="局部结构 ${i+1} 增减方式"><option value="add" ${c.op==='add'?'selected':''}>增加 ＋</option><option value="cut" ${c.op==='cut'?'selected':''}>扣除 −</option></select><button class="delete" data-delete-c="${c.id}" aria-label="删除局部结构 ${i+1}">×</button></div><div class="shape-caption">${esc(shape.name)}</div><div class="correction-fields">${shape.fields.concat([['count','数量','件']]).map(([k,l,u])=>`<label>${l} <small>${u||'mm'}</small><input type="number" min="${(shape.zero||[]).includes(k)?0:0.000001}" step="${k==='count'?1:'any'}" data-cid="${c.id}" data-key="${k}" aria-label="局部结构 ${i+1} ${l}" value="${c[k]}"></label>`).join('')}</div><div class="feature-formula">${esc(shape.formula)}<span id="feature-volume-${c.id}"></span></div></article>`;}).join('');
}
function clearPreset(){activePreset='';document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));$('#presetNote').textContent='自定义截面 · 所有直径均为完整直径，单位 mm。';}
function update(){
 result=E.calculate(model);
 $('#basisBadge').textContent=model.basis;
 $('#weight').textContent=result.valid?fmt(result.weight):'—';
 $('#volume').textContent=result.valid?fmt(result.volume/1000,2):'—';
 $('#total').textContent=result.valid?fmt(result.total):'—';
 $('#quantityLabel').textContent=`kg · ${Number.isFinite(model.quantity)?model.quantity:'—'} 件`;
 $('#errors').hidden=result.valid;
 $('#errors').innerHTML=result.errors.map(s=>`<p>${esc(s)}</p>`).join('');
 for(const s of model.segments){const node=$(`#segment-volume-${s.id}`);if(node)node.textContent=`单段 ${fmt(E.segmentVolume(s)/1000,2)} cm³`;}
 const rows=result.valid?[
 ['实体段体积合计',result.rawAdd],['重叠体积（已去重）',-result.overlap],['内腔扣除（实际相交）',-result.cutVolume],['回转主体净体积',result.bodyVolume],['局部结构增加',result.added],['孔槽 / 局部扣除',-result.removed],['最终净体积',result.volume]]:[];
 $('#breakdown').innerHTML=`<dl>${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${fmt(v/1000,2)} cm³</dd></div>`).join('')}<div><dt>采用密度</dt><dd>${fmt(model.density,2)} g/cm³</dd></div></dl>`;
 document.querySelectorAll('input[type=number]').forEach(el=>{el.setAttribute('aria-invalid',String(el.value===''||!Number.isFinite(el.valueAsNumber)||el.valueAsNumber<Number(el.min)));});
 for(const c of model.corrections){const n=$('#feature-volume-'+c.id);if(n)n.textContent=(c.op==='cut'?'−':'+')+fmt(E.correctionVolume(c)/1000,2)+' cm³';}
 $('#sourceNote').textContent=model.source||'手动参数 / 模板';
 document.dispatchEvent(new CustomEvent('casting-updated'));
 draw();
}
$('#segments').addEventListener('input',ev=>{
 const el=ev.target,s=model.segments.find(x=>x.id===Number(el.dataset.id));if(!s)return;
 const k=el.dataset.key;
 s[k]=k==='name'||k==='op'?el.value:k==='cone'?el.checked:el.valueAsNumber;
 if(!s.cone){s.D1=s.D0;s.d1=s.d0;}
 clearPreset();if(k==='cone'||k==='op')renderSegments();update();
});
$('#segments').addEventListener('click',ev=>{const el=ev.target.closest('[data-delete]');if(!el)return;model.segments=model.segments.filter(s=>s.id!==Number(el.dataset.delete));clearPreset();renderSegments();update();});
$('#addSegment').addEventListener('click',()=>{if(model.segments.length>=600)return;const z=Math.max(0,...model.segments.filter(s=>s.op==='add'&&Number.isFinite(s.z+s.h)).map(s=>s.z+s.h));model.segments.push(seg('新回转段',z,20,100,40));clearPreset();renderSegments();update();const el=$('#segments').querySelector(`[data-segment="${model.segments.at(-1).id}"]`);const details=el.closest('details');if(details)details.open=true;el.querySelector('.segment-name').focus();});
for(const b of document.querySelectorAll('[data-preset]'))b.addEventListener('click',()=>{
 const p=presets[b.dataset.preset]();model={...model,...p,corrections:p.corrections||[],source:'手动参数 / 模板'};activePreset=b.dataset.preset;$('#partName').value=model.name;$('#presetNote').textContent=p.note;document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));renderSegments();renderCorrections();zoom=1;update();
});
for(const id of ['density','quantity','partName','dimensionBasis'])$('#'+id).addEventListener('input',ev=>{model[id==='partName'?'name':id==='dimensionBasis'?'basis':id]=['density','quantity'].includes(id)?ev.target.valueAsNumber:ev.target.value;update();});
$('#addFeature').addEventListener('click',()=>{if(model.corrections.length>=100)return;const type=$('#featureType').value;model.corrections.push(feature(type,E.SHAPES[type].name,{},1,['hole','slot','coneHole','fillet'].includes(type)?'cut':'add'));renderCorrections();update();$('#corrections').lastElementChild.querySelector('input').focus();});
$('#corrections').addEventListener('input',ev=>{const el=ev.target,c=model.corrections.find(x=>x.id===Number(el.dataset.cid));if(!c)return;c[el.dataset.key]=['op','name'].includes(el.dataset.key)?el.value:ev.target.valueAsNumber;update();});
$('#corrections').addEventListener('click',ev=>{const el=ev.target.closest('[data-delete-c]');if(!el)return;model.corrections=model.corrections.filter(c=>c.id!==Number(el.dataset.deleteC));renderCorrections();update();});
$('#helpBtn').addEventListener('click',()=>{$('#instructions').open=true;$('#instructions').scrollIntoView({behavior:'smooth',block:'start'});});
const canvas=$('#viewport'),ctx=canvas.getContext('2d');
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});$('#viewHint').textContent=view==='3d'?'拖动旋转 · 滚轮缩放':'阴影为材料 · 虚线为旋转轴';canvas.style.cursor=view==='3d'?'grab':'default';draw();});
$('#resetView').addEventListener('click',()=>{pitch=.65;yaw=.45;zoom=1;draw();});
let drag=null;
canvas.addEventListener('pointerdown',ev=>{if(view!=='3d')return;drag={x:ev.clientX,y:ev.clientY};canvas.setPointerCapture(ev.pointerId);canvas.style.cursor='grabbing';});
canvas.addEventListener('pointermove',ev=>{if(!drag)return;yaw+=(ev.clientX-drag.x)*.008;pitch=Math.max(-1.4,Math.min(1.4,pitch+(ev.clientY-drag.y)*.008));drag={x:ev.clientX,y:ev.clientY};draw();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;canvas.style.cursor=view==='3d'?'grab':'default';});
canvas.addEventListener('wheel',ev=>{if(view!=='3d')return;ev.preventDefault();zoom=Math.max(.55,Math.min(2,zoom*Math.exp(-ev.deltaY*.001)));draw();},{passive:false});
function draw(){
 const bounds=canvas.getBoundingClientRect(),w=bounds.width,h=bounds.height;if(!w||!h)return;
 const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 ctx.strokeStyle='#aecbdf0b';ctx.lineWidth=1;
 for(let x=0;x<w;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 if(!result.valid){ctx.fillStyle='#9bb1bd';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('请修正尺寸后查看预览',w/2,h/2);return;}
 const g=result.geometry;if(!g.length){ctx.fillStyle='#9bb1bd';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('当前没有可预览的回转主体',w/2,h/2);return;}
 const minZ=Math.min(...g.map(s=>s.z0)),maxZ=Math.max(...g.map(s=>s.z1)),height=maxZ-minZ,maxR=Math.max(...g.flatMap(s=>[s.R0,s.R1]));
 ctx.textAlign='left';ctx.font='12px ui-monospace, monospace';ctx.fillStyle='#89a4b3';ctx.fillText(`Ø ${fmt(maxR*2,1)}  ×  H ${fmt(height,1)} mm`,18,25);
 if(view==='section'){drawSection(g,w,h,minZ,maxZ,maxR);return;}
 const scale=Math.min((w-80)/(maxR*2.5),(h-65)/(maxR*1.5+height))*zoom;
 const rotate=([x,y,z])=>{const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);return [a,y*Math.cos(pitch)-b*Math.sin(pitch),y*Math.sin(pitch)+b*Math.cos(pitch)];};
 const project=p=>{const [x,y,z]=rotate(p);return {x:w/2+x*scale,y:h*.52-y*scale,z};};
 const faces=[],N=g.length>80?20:g.length>30?40:80;
 const point=(r,z,t)=>[r*Math.cos(t),(minZ+maxZ)/2-z,r*Math.sin(t)];
 const addFace=(points,normal,kind)=>{const p=points.map(project),nr=rotate(normal),light=Math.max(0,nr[0]*-.4+nr[1]*.6+nr[2]*.7),tone=kind==='cap'?1.05:.82;faces.push({p,z:p.reduce((a,q)=>a+q.z,0)/p.length,color:`rgb(${Math.round((130+85*light)*tone)},${Math.round((84+74*light)*tone)},${Math.round((51+61*light)*tone)})`});};
 for(const s of g)for(let i=0;i<N;i++){
  const a=i*2*Math.PI/N,b=(i+1)*2*Math.PI/N,m=(a+b)/2;
  const slope=(s.R1-s.R0)/(s.z1-s.z0),norm=Math.hypot(1,slope);
  addFace([point(s.R0,s.z0,a),point(s.R0,s.z0,b),point(s.R1,s.z1,b),point(s.R1,s.z1,a)],[Math.cos(m)/norm,slope/norm,Math.sin(m)/norm],'side');
  if(s.r0||s.r1){const sl=(s.r1-s.r0)/(s.z1-s.z0),n=Math.hypot(1,sl);addFace([point(s.r0,s.z0,b),point(s.r0,s.z0,a),point(s.r1,s.z1,a),point(s.r1,s.z1,b)],[-Math.cos(m)/n,-sl/n,-Math.sin(m)/n],'side');}
  addFace([point(s.r0,s.z0,a),point(s.R0,s.z0,a),point(s.R0,s.z0,b),point(s.r0,s.z0,b)],[0,1,0],'cap');
  addFace([point(s.r1,s.z1,b),point(s.R1,s.z1,b),point(s.R1,s.z1,a),point(s.r1,s.z1,a)],[0,-1,0],'cap');
 }
 const shadow=ctx.createRadialGradient(w/2,h*.79,0,w/2,h*.79,maxR*scale);shadow.addColorStop(0,'#00000033');shadow.addColorStop(1,'#00000000');ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(w/2,h*.79,maxR*scale,maxR*scale*.25,0,0,Math.PI*2);ctx.fill();
 faces.sort((a,b)=>a.z-b.z);for(const f of faces){ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.55;ctx.stroke();}
 const base={x:38,y:h-35};for(const [p,color,label] of [[[1,0,0],'#d18f78','X'],[[0,1,0],'#a8c5ce','Z'],[[0,0,1],'#809fba','Y']]){const v=rotate(p);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(base.x+v[0]*22,base.y-v[1]*22);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=color;ctx.font='11px sans-serif';ctx.fillText(label,base.x+v[0]*30-3,base.y-v[1]*30+3);}
}
function drawSection(g,w,h,minZ,maxZ,maxR){
 const scale=Math.min((w-110)/(2*maxR),(h-105)/(maxZ-minZ)),cx=w/2,top=(h-(maxZ-minZ)*scale)/2;
 const xy=(r,z)=>[cx+r*scale,top+(z-minZ)*scale];
 for(const s of g)for(const sign of [-1,1]){
  const p=[[s.r0*sign,s.z0],[s.R0*sign,s.z0],[s.R1*sign,s.z1],[s.r1*sign,s.z1]].map(v=>xy(...v));ctx.save();ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='#dda06a33';ctx.fill();ctx.strokeStyle='#dda06a';ctx.lineWidth=1;ctx.stroke();ctx.clip();ctx.strokeStyle='#c68b5755';for(let k=-h;k<w+h;k+=9){ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k+h,h);ctx.stroke();}ctx.restore();
 }
 ctx.strokeStyle='#7ac6d0';ctx.lineWidth=1;ctx.setLineDash([9,4,2,4]);ctx.beginPath();ctx.moveTo(cx,top-16);ctx.lineTo(cx,top+(maxZ-minZ)*scale+18);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#89c5cc';ctx.font='12px sans-serif';ctx.fillText('Z',cx+6,top+(maxZ-minZ)*scale+20);
 const x=cx+maxR*scale+19,y0=top,y1=top+(maxZ-minZ)*scale;ctx.strokeStyle='#829daa';ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);for(const y of [y0,y1]){ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);}ctx.stroke();ctx.save();ctx.translate(x+16,(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillStyle='#a9bdc6';ctx.font='12px sans-serif';ctx.fillText(`H ${fmt(maxZ-minZ,1)}`,0,0);ctx.restore();
 ctx.textAlign='left';ctx.fillStyle='#95aab5';ctx.font='12px sans-serif';ctx.fillText(`起端 Z = ${minZ} mm`,18,h-15);
}
new ResizeObserver(()=>draw()).observe(canvas);
$('#partName').value=model.name;$('#featureType').innerHTML=Object.entries(E.SHAPES).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join('');$('#presetNote').textContent=model.note;renderSegments();renderCorrections();update();
// Optional page-scoped WebMCP integration; regular use does not require it.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 const readResult=()=>({name:model.name,basis:model.basis,density_g_cm3:model.density,quantity:model.quantity,valid:result.valid,errors:result.errors,volume_cm3:result.valid?result.volume/1000:null,weight_kg:result.valid?result.weight:null,total_kg:result.valid?result.total:null,segments:model.segments.map(({id,cone,...s})=>s),corrections:model.corrections.map(({id,...c})=>c)});
 const scalar={type:'number',minimum:0,maximum:1000000};
 const tools=[
  {name:'read_casting_calculation',title:'读取铸件重量',description:'Read the current dimensions and calculated theoretical casting mass. Does not change state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>readResult()},
  {name:'set_casting_and_calculate',title:'输入截面并计算重量',description:'Replace the visible casting dimensions and calculate theoretical mass. All lengths and diameters are mm. Density is g/cm³. Corrections are independent net volumes; overlaps between rotational segments are merged automatically.',inputSchema:{type:'object',properties:{name:{type:'string',maxLength:80},basis:{type:'string',enum:['毛坯尺寸','加工后尺寸']},density:{type:'number',exclusiveMinimum:0,maximum:30},quantity:{type:'integer',minimum:1,maximum:1000000000},segments:{type:'array',minItems:1,maxItems:100,items:{type:'object',properties:{name:{type:'string',maxLength:60},op:{type:'string',enum:['add','cut']},z:scalar,h:{type:'number',exclusiveMinimum:0,maximum:1000000},D0:scalar,D1:scalar,d0:scalar,d1:scalar},required:['z','h','D0','D1','d0','d1','op'],additionalProperties:false}},corrections:{type:'array',maxItems:100,items:{type:'object',properties:{type:{type:'string',enum:Object.keys(E.SHAPES)},op:{type:'string',enum:['add','cut']},a:{type:'number',exclusiveMinimum:0},b:{type:'number',minimum:0},c:{type:'number',minimum:0},d:{type:'number',minimum:0},count:{type:'integer',minimum:1,maximum:1000000}},required:['type','op','a','count'],additionalProperties:false}}},required:['density','quantity','segments'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{
   if(!input||typeof input!=='object'||!Array.isArray(input.segments)||input.segments.some(s=>!s||typeof s!=='object')||(input.corrections!==undefined&&(!Array.isArray(input.corrections)||input.corrections.length>100||input.corrections.some(c=>!c||typeof c!=='object'))))throw new Error('无效的截面或修正项。');
   if(input.name!==undefined&&(typeof input.name!=='string'||input.name.length>80))throw new Error('零件名称无效。');
   if(input.basis!==undefined&&!['毛坯尺寸','加工后尺寸'].includes(input.basis))throw new Error('计算口径无效。');
   const next={name:input.name||'自定义铸件',basis:input.basis||'毛坯尺寸',density:input.density,quantity:input.quantity,segments:input.segments.map((s,i)=>({name:typeof s.name==='string'?s.name.slice(0,60):`回转段 ${i+1}`,op:s.op,z:s.z,h:s.h,D0:s.D0,D1:s.D1,d0:s.d0,d1:s.d1,cone:s.D0!==s.D1||s.d0!==s.d1})),corrections:(input.corrections||[]).map(c=>({type:c.type,op:c.op,a:c.a,b:c.b,c:c.c,d:c.d,count:c.count}))};
   const check=E.calculate(next);if(!check.valid)throw new Error(check.errors.join(' '));
   next.segments.forEach(s=>s.id=nextId++);next.corrections.forEach(c=>c.id=nextId++);model=next;
   $('#partName').value=model.name;$('#dimensionBasis').value=model.basis;$('#density').value=model.density;$('#quantity').value=model.quantity;clearPreset();renderSegments();renderCorrections();update();return readResult();
  }}
 ];
 for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
 addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
// Image and profile tools update the same validated model as manual editing.
globalThis.CastingApp={
 getModel:()=>JSON.parse(JSON.stringify(model)),
 setModel:next=>{const candidate={...model,...next};const r=E.calculate(candidate);if(!r.valid)throw new Error(r.errors.join(' '));model=candidate;model.segments.forEach(s=>{s.id=nextId++;s.cone=s.D0!==s.D1||s.d0!==s.d1;});model.corrections.forEach(c=>c.id=nextId++);$('#partName').value=model.name;$('#density').value=model.density;$('#quantity').value=model.quantity;$('#dimensionBasis').value=model.basis;clearPreset();renderSegments();renderCorrections();update();},
 getResult:()=>result
};
$('#addProfile').addEventListener('click',()=>{try{
 const points=$('#profilePoints').value.trim().split(/\n+/).map(row=>row.trim().split(/[\s,，;；]+/).map(Number));
 const segments=E.polygonSegments(points,$('#profileOp').value);
 globalThis.CastingApp.setModel({segments:[...model.segments,...segments],source:'手动截面坐标 / 组合模型'});
 $('#profileError').hidden=true;
}catch(error){$('#profileError').textContent=error.message;$('#profileError').hidden=false;}});
