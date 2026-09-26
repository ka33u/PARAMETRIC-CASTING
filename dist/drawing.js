(function(){
'use strict';
const $=s=>document.querySelector(s),C=globalThis.DrawingCore,A=globalThis.CastingApp,E=globalThis.CastingEngine;
let image=null,blob=null,objectURL=null,items=[],candidates=[],selected=-1,service=false,mode='',axis=[],calibration=[],outline=[],imageVersion=0,busy=false,displayScale=1;
const canvas=$('#drawingCanvas'),ctx=canvas.getContext('2d');
const say=text=>$('#drawingStatus').textContent=text;
const fail=error=>{const el=$('#drawingError');el.textContent=error?.message||String(error);el.hidden=false;};
const clearError=()=>$('#drawingError').hidden=true;
function resetChecks(){$('#confirmDimensions').checked=false;$('#confirmTrace').checked=false;}
function resetTrace(){axis=[];calibration=[];outline=[];mode='';$('#confirmTrace').checked=false;updateTrace();}
async function checkService(){
 if(location.protocol==='file:'){$('#ocrAvailability').textContent='离线模式 · 手动输入 / 描点可用';$('#runOCR').disabled=true;$('#runOCR').title='请双击“启动铸衡.command”使用本机 OCR';return;}
 try{const r=await fetch('/api/status',{signal:AbortSignal.timeout(2000)}),data=await r.json();service=data.service==='casting-local-ocr'&&data.ocr;}catch{service=false;}
 $('#ocrAvailability').textContent=service?'本机 OCR 可用 · 图纸不上传':'识别未连接 · 可手动输入 / 描点';$('#runOCR').disabled=!service;
 if(!service)$('#runOCR').title='请从“启动铸衡.command”启动本机识别版';
}
function draw(){
 if(!image)return;
 const stage=$('.drawing-stage'),ratio=Math.min((stage.clientWidth-2)/image.width,560/image.height),magnify=Number($('#drawingZoom')?.value||1);
 const w=Math.max(1,image.width*ratio*magnify),h=Math.max(1,image.height*ratio*magnify),dpr=Math.min(devicePixelRatio||1,2);
 displayScale=ratio*magnify;canvas.style.width=w+'px';canvas.style.height=h+'px';canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(image,0,0,w,h);
 const line=(list,color,closed=false)=>{if(!list.length)return;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();list.forEach((p,i)=>{const x=p.x*displayScale,y=p.y*displayScale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});if(closed&&list.length>2){ctx.closePath();ctx.fillStyle='#e9823b33';ctx.fill();}ctx.stroke();for(const p of list){ctx.beginPath();ctx.arc(p.x*displayScale,p.y*displayScale,3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}};
 if(selected>=0&&candidates[selected]?.box){const b=candidates[selected].box;ctx.strokeStyle='#ff8b35';ctx.lineWidth=3;ctx.strokeRect(b.x*w,b.y*h,b.width*w,b.height*h);}
 line(calibration,'#2eda83');
 if(axis.length===2){const [a,b]=axis,dx=b.x-a.x,dy=b.y-a.y;ctx.setLineDash([8,5]);line([{x:a.x-dx*20,y:a.y-dy*20},{x:b.x+dx*20,y:b.y+dy*20}],'#23d8ee');ctx.setLineDash([]);}else line(axis,'#23d8ee');
 line(outline,'#ff953d',true);
}
function parse(input,auto=false){
 const parsed=C.parseDimensions(input,A.getModel().basis);candidates=parsed.candidates;selected=-1;
 const target=$('#ocrCandidates');target.replaceChildren();
 if(!candidates.length){const p=document.createElement('p');p.className='assistant-help';p.textContent='没有提取到尺寸。可旋转 / 放大原图后重试，或在下面手动填写。';target.append(p);}
 candidates.forEach((c,index)=>{const b=document.createElement('button');b.type='button';b.className='candidate'+(c.ambiguous||(c.confidence!==null&&c.confidence<.8)?' uncertain':'');b.textContent=c.kind+' '+c.value+(c.finished!==null?' ('+c.cast+' / '+c.finished+')':'');b.title='原文：'+c.raw+'；'+(c.confidence===null?'手动文字':'OCR 置信度 '+Math.round(c.confidence*100)+'%')+'。点击后可填入所选字段。';b.addEventListener('click',()=>{selected=index;const dest=$('#candidateTarget').value;$('#'+dest).value=c.value;$('#confirmDimensions').checked=false;target.querySelectorAll('button').forEach((el,i)=>el.classList.toggle('selected',i===index));draw();});target.append(b);});
 $('#dimensionValues').replaceChildren();for(const v of [...new Set(candidates.map(c=>c.value))]){const o=document.createElement('option');o.value=v;$('#dimensionValues').append(o);}
 if(auto){for(const key of ['D','d','H'])$('#map'+key).value=parsed.draft[key]??'';}
 resetChecks();
 say(candidates.length?`提取到 ${candidates.length} 个候选尺寸。${Object.keys(parsed.draft).length?'已根据明确的外径 / 内径 / 长度标签填写草稿。':'请核对标注所属部位，再映射到参数。'}`:'尚未识别出可用尺寸，可手动输入或描点。');draw();
}
async function loadFile(file){
 clearError();if(!file)return;
 if(!/^image\/(png|jpeg|webp|bmp|tiff)$/.test(file.type))return fail('请使用 PNG、JPG、WebP、BMP 或 TIFF 图片；PDF 请先导出所需图页。');
 if(file.size>15*1024*1024)return fail('图片超过 15 MB，请裁剪图页后重试。');
 const version=++imageVersion;window.dispatchEvent(new Event('casting-drawing-change'));const url=URL.createObjectURL(file),img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('无法读取这张图片。'));img.src=url;});if(version!==imageVersion){URL.revokeObjectURL(url);return;}if(img.width*img.height>24e6)throw new Error('图纸像素过大，请裁剪到 2400 万像素以内。');
 if(objectURL)URL.revokeObjectURL(objectURL);objectURL=url;image=img;blob=file;items=[];candidates=[];selected=-1;$('#ocrText').value='';$('#ocrCandidates').replaceChildren();$('#drawingAssistant').open=true;$('#drawingWorkspace').hidden=false;$('#drawingZoom').value='1';for(const k of ['D','d','H'])$('#map'+k).value='';resetChecks();resetTrace();draw();say('图纸已加载。点击右侧“AI 识别并计算”，或使用 OCR 尺寸 / 截面描点。');
 }catch(error){URL.revokeObjectURL(url);fail(error);}
}
async function recognize(){
 if(!image||!blob||!service||busy)return;const version=imageVersion;busy=true;$('#runOCR').disabled=true;clearError();say('正在本机识别图纸标注…');
 try{const r=await fetch('/api/ocr',{method:'POST',headers:{'Content-Type':blob.type,'X-Casting-Client':'drawing-assistant'},body:blob,signal:AbortSignal.timeout(100000)}),data=await r.json();if(!r.ok)throw new Error(data.error||'识别失败。');if(version!==imageVersion)return;items=data.items;$('#ocrText').value=items.map(x=>x.text).join('\n');parse(items,true);}catch(error){if(version===imageVersion){say('自动识别未完成，仍可手动填写尺寸或使用描点。');fail(error.name==='TimeoutError'?'识别超时，请裁剪图片后重试。':error);}}finally{busy=false;$('#runOCR').disabled=!service;}
}
function applyDimensions(append){
 clearError();try{
 if(!$('#confirmDimensions').checked)throw new Error('请先核对尺寸并勾选确认。');
 const D=Number($('#mapD').value),d=Number($('#mapd').value),h=Number($('#mapH').value),z=Number($('#mapZ').value);
 if(['mapD','mapd','mapH','mapZ'].some(id=>$('#'+id).value===''))throw new Error('请完整填写四个尺寸，实心圆柱内径填 0。');
 const s={name:'图纸尺寸段',op:'add',z,h,D0:D,D1:D,d0:d,d1:d};const current=A.getModel();
 A.setModel({name:append?current.name:'图纸参数铸件',segments:append?[...current.segments,s]:[s],corrections:append?current.corrections:[],source:'图纸尺寸 · 人工已核对'});
 say('尺寸已应用，重量和截面已更新。复杂零件请继续添加其余结构。');
 }catch(error){fail(error);}
}
function updateTrace(){
 const len=calibration.length===2?Math.hypot(calibration[0].x-calibration[1].x,calibration[0].y-calibration[1].y):0;
 $('#scaleStatus').textContent=len?`${(Number($('#traceLength').value)/len).toFixed(5)} mm / 像素`:'未标定';$('#axisStatus').textContent=axis.length===2?'已设置（蓝色虚线）':'未设置';$('#traceStatus').textContent=outline.length?`已描 ${outline.length} 点；点序按材料边界首尾相连。`:'尚未描点';draw();
}
function applyTrace(append){
 clearError();try{if(!$('#confirmTrace').checked)throw new Error('请先核对描点结果并勾选确认。');const points=C.traceToProfile(outline,axis,calibration,Number($('#traceLength').value)),segments=E.polygonSegments(points);const current=A.getModel();A.setModel({name:append?current.name:'图纸描点铸件',segments:append?[...current.segments,...segments]:segments,corrections:append?current.corrections:[],source:'轮廓描点估算 · 精度取决于图纸比例与选点'});say('截面已转换为回转段并计算。追加区域使用同一旋转轴、同一轴向基准。');}catch(error){fail(error);}
}
$('#drawingFile').addEventListener('change',ev=>loadFile(ev.target.files[0]));
$('#drawingAssistant').addEventListener('paste',ev=>{const file=[...ev.clipboardData.items].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){ev.preventDefault();loadFile(file);}});
$('#runOCR').addEventListener('click',recognize);
$('#parseDimensions').addEventListener('click',()=>{clearError();items=[];parse($('#ocrText').value,true);});
$('#applyDimensions').addEventListener('click',()=>applyDimensions(false));$('#appendDimensions').addEventListener('click',()=>applyDimensions(true));
for(const id of ['mapD','mapd','mapH','mapZ'])$('#'+id).addEventListener('input',()=>$('#confirmDimensions').checked=false);
$('#dimensionBasis').addEventListener('change',()=>{if(items.length)parse(items,false);else if($('#ocrText').value)parse($('#ocrText').value,false);$('#confirmDimensions').checked=false;say('计算口径已切换，请重新选择或核对尺寸。');});
$('#rotateDrawing').addEventListener('click',()=>{if(!image)return;const temp=document.createElement('canvas');temp.width=image.height;temp.height=image.width;const g=temp.getContext('2d');g.translate(temp.width,0);g.rotate(Math.PI/2);g.drawImage(image,0,0);temp.toBlob(b=>{if(b)loadFile(new File([b],'rotated.png',{type:'image/png'}));},'image/png');});
$('#clearDrawing').addEventListener('click',()=>{imageVersion++;window.dispatchEvent(new Event('casting-drawing-change'));if(objectURL)URL.revokeObjectURL(objectURL);image=null;blob=null;objectURL=null;items=[];candidates=[];$('#drawingWorkspace').hidden=true;$('#drawingFile').value='';resetChecks();clearError();});
for(const b of document.querySelectorAll('[data-assistant-view]'))b.addEventListener('click',()=>{for(const name of ['trace','dimension','vision'])$('#'+name+'Assistant').hidden=(name==='dimension'?'dimensions':name)!==b.dataset.assistantView;document.querySelectorAll('[data-assistant-view]').forEach(x=>x.classList.toggle('active',x===b));mode='';draw();});
$('#calibrateTrace').addEventListener('click',()=>{calibration=[];mode='calibration';$('#confirmTrace').checked=false;say('请在原图点击一个已知尺寸的两个端点。');updateTrace();});
$('#axisTrace').addEventListener('click',()=>{axis=[];mode='axis';$('#confirmTrace').checked=false;say('请沿旋转轴的 Z 正向依次点两点。第一点作为所有区域的共同 Z = 0 基准。');updateTrace();});
$('#outlineTrace').addEventListener('click',()=>{mode='outline';say('沿旋转轴一侧的闭合材料边界依次点击，末点会自动连回首点。');});
$('#undoTrace').addEventListener('click',()=>{outline.pop();$('#confirmTrace').checked=false;updateTrace();});$('#resetTrace').addEventListener('click',()=>{outline=[];$('#confirmTrace').checked=false;updateTrace();});
$('#traceLength').addEventListener('input',()=>{$('#confirmTrace').checked=false;updateTrace();});
canvas.addEventListener('click',ev=>{if(!image||!mode)return;const b=canvas.getBoundingClientRect(),p={x:(ev.clientX-b.left)/b.width*image.width,y:(ev.clientY-b.top)/b.height*image.height};if(mode==='calibration'){calibration.push(p);if(calibration.length===2)mode='';}else if(mode==='axis'){axis.push(p);if(axis.length===2)mode='';}else if(outline.length<60)outline.push(p);else return fail('每块截面最多 60 个点，请分块描点。');$('#confirmTrace').checked=false;updateTrace();});
$('#applyTrace').addEventListener('click',()=>applyTrace(false));$('#appendTrace').addEventListener('click',()=>applyTrace(true));$('#drawingZoom').addEventListener('input',draw);
new ResizeObserver(()=>draw()).observe($('.drawing-stage'));
globalThis.CastingDrawing={
 getVersion:()=>imageVersion,
 snapshot:async()=>{if(!image||!blob)throw new Error('请先选择图纸图片。');const version=imageVersion;
 let encoded;if(['image/png','image/jpeg'].includes(blob.type)){encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('无法读取图片。'));r.readAsDataURL(blob);});}
 else{const temp=document.createElement('canvas');temp.width=image.width;temp.height=image.height;temp.getContext('2d').drawImage(image,0,0);encoded=temp.toDataURL('image/png').split(',')[1];}
 return {image:encoded,version};}
};
checkService();
})();
