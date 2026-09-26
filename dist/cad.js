/* Local CAD selection: drawing geometry is never uploaded to an external service. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),C=globalThis.CastingCAD;
const canvas=$('cadCanvas'),ctx=canvas.getContext('2d');
let drawing=null,drawingId='',filename='',record=null,selected=new Set(),axis=null,side=1,lastPoint=null;
let action='select',points=[],view={x:0,y:0,scale:1},width=800,height=580,drag=null,hover=null;
let result=null,busy=false,revision=0,catalog=[],lastHit=null,applied=false;
const fmt=(v,n=3)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:n}):'—';
const text=(id,value)=>$(id).textContent=value;
function error(message=''){text('cadError',message);$('cadError').hidden=!message;}
function status(message){text('cadStatus',message);}
function invalidate(){revision++;result=null;applied=false;$('cadResult').hidden=true;$('cadConfirm').checked=false;error();}
function setBusy(value){busy=value;for(const id of ['cadCalculate','cadApply','cadAppend','cadDemo','cadLibraryRefresh'])$(id).disabled=value;canvas.style.cursor=value?'wait':action==='select'?'crosshair':'cell';}
async function api(path,body,headers={}){
 const options=body===undefined?{}:{method:'POST',headers:{'X-Casting-Client':'drawing-assistant',...headers},body};
 const response=await fetch(path,options);let value;try{value=await response.json();}catch{throw Error('本地 CAD 服务不可用，请重新运行“启动铸衡.command”。');}
 if(!response.ok||value.error)throw Error(value.error||'CAD 请求未完成。');return value;
}
async function run(task){if(busy)return;error();setBusy(true);try{await task();}catch(e){error(e.message);}finally{setBusy(false);}}
function mode(value){action=value;points=[];for(const [id,v] of [['cadSelect','select'],['cadAxisLine','axisLine'],['cadAxisPoints','axisPoints'],['cadCalibrate','calibrate']])$(id).classList.toggle('active',v===value);
 text('cadCanvasHint',({select:'滚轮缩放 · 拖动平移 · 单击选材料 · Alt + 单击切换重叠区域',axisLine:'单击轴线附近，蓝线为计算轴；先放大可提高选择精度。',axisPoints:'沿同一旋转轴依次点击两点，自动吸附附近线条端点。',calibrate:'先填右侧实际长度，再依次点击对应尺寸的两个端点。'})[value]);draw();}
function screen(p){return [(p[0]-view.x)*view.scale+width/2,height/2-(p[1]-view.y)*view.scale];}
function world(p){return [(p[0]-width/2)/view.scale+view.x,(height/2-p[1])/view.scale+view.y];}
function local(ev){const r=canvas.getBoundingClientRect();return [ev.clientX-r.left,ev.clientY-r.top];}
function fit(bounds){if(!bounds)return;const [x0,y0,x1,y1]=bounds;view={x:(x0+x1)/2,y:(y0+y1)/2,scale:Math.min((width-60)/Math.max(x1-x0,1),(height-60)/Math.max(y1-y0,1))};draw();}
function path(polygons){ctx.beginPath();for(const p of polygons)for(const ring of [p.outer,...p.holes]){ring.forEach((p,i)=>{const q=screen(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}}
function draw(){
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#f8fafb';ctx.fillRect(0,0,width,height);if(!drawing)return;
 for(const region of drawing.regions){if(region.source==='hatch'){path(region.polygons);ctx.fillStyle='#bccbd43d';ctx.fill('evenodd');}}
 // Native drawing boundaries, with text kept readable at useful zoom levels.
 for(const line of drawing.lines){ctx.beginPath();line.points.forEach((p,i)=>{const q=screen(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=line.axis?'#a1b8c4':'#667982';ctx.lineWidth=line.axis?.7:.8;ctx.setLineDash(line.axis?[9,3,2,3]:[]);ctx.stroke();}ctx.setLineDash([]);
 for(const t of drawing.texts){const size=t.height*view.scale;if(size<4||size>160)continue;const p=screen([t.x,t.y]);if(p[0]<-300||p[0]>width+300||p[1]<-100||p[1]>height+100)continue;ctx.save();ctx.translate(...p);ctx.rotate(-t.rotation*Math.PI/180);ctx.fillStyle='#394e59';ctx.font=`${Math.max(size,5)}px sans-serif`;ctx.fillText(t.text,0,0);ctx.restore();}
 for(const region of drawing.regions){if(!selected.has(region.id)&&hover!==region.id)continue;path(region.polygons);ctx.fillStyle=selected.has(region.id)?'#e89b4a66':'#3c91b02c';ctx.fill('evenodd');ctx.strokeStyle=selected.has(region.id)?'#c97423':'#237c9e';ctx.lineWidth=1.6;ctx.stroke();}
 if(result?.material){path(result.material);ctx.fillStyle='#39a47b45';ctx.fill('evenodd');ctx.strokeStyle='#22845f';ctx.lineWidth=1.5;ctx.stroke();}
 if(axis){const [a,b]=axis,len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len,span=(width+height)/view.scale;ctx.beginPath();ctx.moveTo(...screen([a[0]-dx*span,a[1]-dy*span]));ctx.lineTo(...screen([a[0]+dx*span,a[1]+dy*span]));ctx.setLineDash([10,4,2,4]);ctx.strokeStyle='#197cba';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);}
 for(const p of points){ctx.beginPath();ctx.arc(...screen(p),4,0,Math.PI*2);ctx.fillStyle='#d77b2d';ctx.fill();}
}
function resize(){const bounds=canvas.getBoundingClientRect();if(!bounds.width)return;const prior=width;width=bounds.width;height=bounds.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(drawing&&prior!==width)fit(drawing.bounds);else draw();}
new ResizeObserver(resize).observe(canvas);
function snap(p){let best=p,d=10/view.scale;for(const l of drawing.lines)for(const q of [l.points[0],l.points.at(-1)]){const n=Math.hypot(q[0]-p[0],q[1]-p[1]);if(n<d){d=n;best=q;}}return [...best];}
function updateSelection(){text('cadSelection',`已选 ${selected.size} 个闭合区域${selected.size?' · 橙色为原选区，计算后绿色为实际材料':''}`);text('cadAxisStatus',axis?`旋转轴已设置 · 计算侧 ${side>0?'A':'B'}`:'旋转轴未设置');draw();}
function choose(p,alt){
 if(action==='axisLine'){
  let best=null,d=10/view.scale;for(const l of drawing.lines){if(l.points.length!==2)continue;const n=C.distanceToLine(p,...l.points);if(n<d){d=n;best=l;}}
  if(!best){error('此处没有直线，请放大后选择轴线，或使用“两点定轴”。');return;}
  invalidate();axis=best.points.map(p=>[...p]);if(lastPoint)side=C.sideOf(axis,lastPoint);mode('select');
 }else if(action==='axisPoints'||action==='calibrate'){
  points.push(snap(p));if(points.length===2){try{if(action==='axisPoints'){if(Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1])<1e-8)throw Error('轴线上两点不能重合。');invalidate();axis=points.map(p=>[...p]);if(lastPoint)side=C.sideOf(axis,lastPoint);}else{const value=C.calibration(...points,$('cadKnownLength').valueAsNumber);invalidate();$('cadScale').value=Number(value.toPrecision(12));text('cadScaleHint',`已标定：1 图形单位 = ${fmt(value,8)} mm。局部放大图需要单独标定。`);}mode('select');}catch(e){points=[];error(e.message);}}
 }else{
  const hits=C.hits(drawing.regions,p);if(!hits.length){error('此处没有闭合区域。可放大后点击材料内部；有缺口时需先在 CAD 中闭合边界。');return;}
  let hit=hits[0];if(alt&&lastHit&&Math.hypot(...p.map((v,i)=>v-lastHit.point[i]))<8/view.scale){const index=hits.findIndex(h=>h.id===lastHit.id);hit=hits[(index+1)%hits.length];selected.delete(lastHit.id);}
  invalidate();if(selected.has(hit.id))selected.delete(hit.id);else selected.add(hit.id);lastHit={id:hit.id,point:p};lastPoint=p;if(axis)side=C.sideOf(axis,p);
 }
 updateSelection();
}
canvas.addEventListener('pointerdown',ev=>{if(!drawing||busy)return;canvas.setPointerCapture(ev.pointerId);drag={start:local(ev),view:{...view},moved:false};});
canvas.addEventListener('pointermove',ev=>{if(!drawing||busy)return;const p=local(ev);if(drag){const dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){view.x=drag.view.x-dx/view.scale;view.y=drag.view.y+dy/view.scale;draw();}}else if(action==='select'){const hit=C.hits(drawing.regions,world(p))[0];if(hover!==(hit?.id||null)){hover=hit?.id||null;draw();}}});
canvas.addEventListener('pointerup',ev=>{if(!drag)return;const click=!drag.moved;drag=null;if(click)choose(world(local(ev)),ev.altKey);});
canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('pointerleave',()=>{hover=null;draw();});
canvas.addEventListener('wheel',ev=>{if(!drawing)return;ev.preventDefault();const p=local(ev),before=world(p);view.scale=Math.max(1e-7,Math.min(1e6,view.scale*Math.exp(-ev.deltaY*.001)));const after=world(p);view.x+=before[0]-after[0];view.y+=before[1]-after[1];draw();},{passive:false});
function receive(data,name){
 invalidate();drawing=data.drawing;drawingId=data.drawing_id;record=data.record||null;filename=record?`${record.series}-${record.frame} ${record.kind} · ${record.name}`:name||'CAD 图纸';selected.clear();axis=null;side=1;lastPoint=null;lastHit=null;hover=null;
 $('cadWorkspace').hidden=false;text('cadFilename',filename);text('cadGuide',record?.guide||'先选同一视图中的材料剖面。回转件需设置轴线；筋板、底脚等选面积后输入净厚度。');
 const meta=drawing.metadata||{};text('cadMeta',[data.format,`${drawing.regions.length} 个闭合区域`,`单位：${drawing.unit_name}`,meta.materials?.length?`材料文字：${meta.materials.join(' / ')}`:'材料待核对',meta.scale_labels?.length?`图签比例：${meta.scale_labels.join('、')}`:''].filter(Boolean).join(' · '));
 $('cadScale').value=drawing.mm_per_unit||'';$('cadScale').removeAttribute('aria-invalid');text('cadScaleHint',drawing.mm_per_unit?'已读取文件单位，仍需核对实际标注；局部放大图需重新标定。':'旧图未指定实际单位：输入每图形单位对应的 mm，或用已知长度两点标定。图签比例不会自动套用。');
 $('cadBasis').value=record?.basis_hint==='毛坯候选'?'毛坯尺寸':record?.basis_hint==='加工候选'?'加工后尺寸':'';
 $('cadMode').value=['接线盒','底脚','平衡块'].includes(record?.kind)?'extrude':'revolve';changeMode();$('cadPartName').value=filename.replace(/\.(dwg|dxf)$/i,'');
 const warnings=[...(drawing.warnings||[])];if(meta.non_gray_material)warnings.unshift('检测到非灰铸铁材料文字，请核对该零件；当前工具采用灰铸铁密度，不能直接套用。');if(!meta.material_confirmed_gray)warnings.unshift('未能从图内文字确认灰铸铁材质，请查看标题栏。');
 warnings.push(`曲线按 ${drawing.curve_tolerance} 图形单位的弦差离散；重量是所选结构估算。圆角、未选筋板和孔槽需核对。`);
 $('cadWarningList').replaceChildren(...warnings.map(w=>{const li=document.createElement('li');li.textContent=w;return li;}));$('cadWarnings').open=!!meta.non_gray_material;
 mode('select');resize();fit(drawing.bounds);updateSelection();status('图纸已读取。先放大剖面并点击材料区域，再设置轴线和比例。');
 $('cadWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
}
async function importFile(file){if(file.size>30*1024*1024)throw Error('图纸须小于 30 MB。');const ext=file.name.split('.').pop().toLowerCase();if(!['dwg','dxf'].includes(ext))throw Error('EXB 目前可收录目录，但不能直接计算。请用 CAXA 导出 DWG／DXF 后导入。');status('正在本机转换并读取 CAD 几何…');receive(await api('/api/cad/import',file,{'X-Cad-Format':ext,'Content-Type':'application/octet-stream'}),file.name);}
function changeMode(){$('cadRevolveControls').hidden=$('cadMode').value!=='revolve';$('cadExtrudeControls').hidden=$('cadMode').value!=='extrude';}
for(const [id,v] of [['cadSelect','select'],['cadAxisLine','axisLine'],['cadAxisPoints','axisPoints'],['cadCalibrate','calibrate']])$(id).onclick=()=>{if(!busy)mode(v);};
$('cadFit').onclick=()=>drawing&&fit(drawing.bounds);
$('cadZoomSelection').onclick=()=>{if(!drawing||!selected.size)return;const all=drawing.regions.filter(r=>selected.has(r.id)).flatMap(r=>r.polygons.flatMap(p=>p.outer));fit([Math.min(...all.map(p=>p[0])),Math.min(...all.map(p=>p[1])),Math.max(...all.map(p=>p[0])),Math.max(...all.map(p=>p[1]))]);};
$('cadClear').onclick=()=>{if(busy)return;invalidate();selected.clear();updateSelection();};
$('cadFlipSide').onclick=()=>{invalidate();side*=-1;updateSelection();};
$('cadFile').onchange=ev=>{const file=ev.target.files[0];if(file)run(()=>importFile(file));ev.target.value='';};
$('cadDemo').onclick=()=>run(async()=>{const response=await fetch('cad-demo.dxf');if(!response.ok)throw Error('示例需要通过本地服务打开。');await importFile(new File([await response.blob()],'cad-demo.dxf'));$('cadScale').value=1;$('cadBasis').value='毛坯尺寸';status('演示尺寸，非实际图纸：选右侧橙色前的闭合剖面，再点选 x=0 的中心线。');});
for(const id of ['cadScale','cadKnownLength','cadBasis','cadThickness','cadCount','cadMode'])$(id).addEventListener('input',()=>{invalidate();$(id).removeAttribute('aria-invalid');changeMode();draw();});
function resultText(){if(!result)return;const density=globalThis.CastingApp.getModel().density;text('cadWeight',`${fmt(result.volume*density/1e6)} kg`);text('cadVolume',`${fmt(result.volume/1000,2)} cm³ · 密度 ${fmt(density,2)} g/cm³`);}
document.addEventListener('casting-updated',resultText);
$('cadCalculate').onclick=()=>run(async()=>{
 if(!drawing||!selected.size)throw Error('请先导入图纸并点击材料内部选区。');if(!$('cadBasis').value)throw Error('请选择所选轮廓是毛坯还是加工后。');if(!$('cadConfirm').checked)throw Error('请核对材料、比例和净材料区域，再勾选核对项。');
 const scale=$('cadScale').valueAsNumber;if(!Number.isFinite(scale)||scale<=0)throw Error('图形比例未设置，请标定或输入实际单位。');
 const request={drawing_id:drawingId,selected:[...selected],mode:$('cadMode').value,scale,axis,side,thickness:$('cadThickness').valueAsNumber,count:$('cadCount').valueAsNumber};
 if(request.mode==='revolve'&&!axis)throw Error('请先点选轴线或两点定轴。');
 const version=revision;status('正在计算选区净面积和体积…');const value=await api('/api/cad/calculate',JSON.stringify(request),{'Content-Type':'application/json'});if(version!==revision)return;
 result={...value,basis:$('cadBasis').value,request};applied=false;$('cadResult').hidden=false;resultText();text('cadResultHint',(value.clipped?'已按指定轴线只计算一侧，避免上下剖面重复回转。':'')+'仅包含本次所选结构；筋板、底脚、安装耳和孔槽需另行核对。');status('选区计算完成，可新建模型，或按净体积追加到当前模型。');draw();
});
function apply(append){try{
 if(!result)throw Error('请先计算当前选区。');if(applied)throw Error('本次选区已载入。修改选区并重新计算后再追加，避免重复计料。');
 const current=globalThis.CastingApp.getModel(),name=$('cadPartName').value.trim()||filename,source=`CAD：${filename} · ${result.basis} · 比例 ${fmt(result.request.scale,8)} mm/单位 · ${result.request.mode==='extrude'?`拉伸 ${fmt(result.request.thickness)} mm × ${result.request.count} 件`:'回转选区'} · 所选结构，待核对整件完整性`;
 if(append&&current.basis!==result.basis)throw Error('当前模型与所选图纸的毛坯／加工口径不同，请统一口径后再追加。');
 const feature={type:'volume',name,op:append?$('cadOperation').value:'add',a:result.feature?.a??result.volume/1000,count:result.feature?.count??1,cadSource:source};
 if(append)globalThis.CastingApp.setModel({corrections:[...current.corrections,feature],source:current.source+'；追加 '+source});
 else globalThis.CastingApp.setModel({name,basis:result.basis,segments:result.segments||[],corrections:result.segments?.length?[]:[feature],source});
 applied=true;status(append?'已追加净体积。请在下方局部结构明细中核对。':'已用选区新建模型，下方可查看三维回转主体和计算明细。');
 }catch(e){error(e.message);}}
$('cadApply').onclick=()=>apply(false);$('cadAppend').onclick=()=>apply(true);
function renderLibrary(){
 const query=$('cadSearch').value.trim().toLowerCase(),series=$('cadSeries').value,kind=$('cadKind').value,frame=$('cadFrame').value;
 const entries=catalog.filter(e=>(!series||e.series===series)&&(!kind||e.kind===kind)&&(!frame||e.frame===frame)&&(!query||`${e.name} ${e.relative}`.toLowerCase().includes(query))).sort((a,b)=>(a.basis_hint==='毛坯候选'?0:1)-(b.basis_hint==='毛坯候选'?0:1)||a.relative.localeCompare(b.relative,'zh-CN'));
 text('cadLibraryCount',`${entries.length} 份匹配 / ${catalog.length} 份候选`);
 const nodes=entries.slice(0,70).map(e=>{const button=document.createElement('button');button.className='cad-library-row';const title=document.createElement('strong');title.textContent=`${e.series} · ${e.name}`;const detail=document.createElement('span');detail.textContent=`${e.kind} · ${e.basis_hint} · ${e.relative}`;const tag=document.createElement('em');tag.textContent=e.readable?'读取 '+e.format:'EXB 待转换';button.append(title,detail,tag);button.onclick=()=>{if(!e.readable){error('这份 EXB 仅完成编目，当前不能直接读取几何。CAXA 导出 DWG／DXF 后可通过上方按钮导入。');return;}run(async()=>{status('正在读取原图：'+e.relative);receive(await api('/api/cad/library/open',JSON.stringify({id:e.id}),{'Content-Type':'application/json'}),e.name);});};return button;});
 if(entries.length>70){const hint=document.createElement('p');hint.textContent='显示前 70 份，请用类别、机座号或关键词缩小范围。';nodes.push(hint);}if(!entries.length){const hint=document.createElement('p');hint.textContent='没有匹配图纸。请检查筛选条件和磁盘连接。';nodes.push(hint);}$('cadLibraryList').replaceChildren(...nodes);
}
async function loadLibrary(open){const data=await api('/api/cad/library');catalog=data.entries;text('cadLibraryNote',`${Object.entries(data.totals).map(([k,v])=>k+' '+v+' 份 CAD 文件').join(' / ')}。${data.note}`);
 for(const [id,key,label] of [['cadSeries','series','全部系列'],['cadKind','kind','全部类别'],['cadFrame','frame','全部机座号']]){const select=$(id),prior=select.value;select.replaceChildren(new Option(label,''),...[...new Set(catalog.map(e=>e[key]))].sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true})).map(v=>new Option(v,v)));select.value=prior;}
 renderLibrary();if(open)$('cadLibrary').open=true;
 if(!Object.values(data.connected).some(Boolean))status('未找到 kakku’s disk 的图纸目录；仍可直接导入 DWG / DXF。');
}
for(const id of ['cadSearch','cadSeries','cadKind','cadFrame'])$(id).oninput=renderLibrary;
$('cadLibraryRefresh').onclick=()=>run(()=>loadLibrary(true));
if(location.protocol==='file:'){text('cadAvailability','请用本地服务打开');status('CAD 转换和图纸库需要本地服务。请双击“启动铸衡.command”；离线文件仍可手工估重。');for(const id of ['cadFile','cadDemo','cadLibraryRefresh'])$(id).disabled=true;}
else api('/api/cad/status').then(async s=>{text('cadAvailability',s.dwg?'DWG / DXF 已就绪':s.dxf?'DXF 已就绪':'CAD 组件未安装');if(!s.dxf)status('请运行“准备CAD组件.command”安装免费的本地 CAD 组件。');await loadLibrary(false);}).catch(e=>{text('cadAvailability','本地服务未连接');error(e.message);});
})();
