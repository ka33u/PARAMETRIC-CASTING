(function(){
'use strict';
const $=s=>document.querySelector(s),A=globalThis.CastingApp,E=globalThis.CastingEngine,D=globalThis.CastingDrawing,V=globalThis.CastingVisionCore;
let busy=false,draft=null,revision=0,available=false;
const message=text=>$('#visionProgress').textContent=text;
const error=text=>{const el=$('#visionError');el.textContent=text;el.hidden=!text;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function node(tag,text,className){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;}
async function check(){
 if(location.protocol==='file:'){$('#visionAvailability').textContent='需启动本机服务';message('请双击“启动铸衡.command”使用本地 AI；单文件离线版仍可手动输入和描点。');$('#runVision').disabled=true;$('#refreshVision').disabled=true;return;}
 try{const r=await fetch('/api/vision/status',{signal:AbortSignal.timeout(6000)});if(!r.ok)throw new Error('本地服务版本未更新，请重新启动工具。');const s=await r.json();available=true;$('#visionAvailability').textContent=s.model;message(s.message+(s.installed?' · 图纸仅在本机处理。':''));}
 catch(e){available=false;$('#visionAvailability').textContent='识图服务未连接';message(e.message==='Failed to fetch'?'请从“启动铸衡.command”启动本机识图版。':e.message);}
 $('#runVision').disabled=busy||!available;
}
function render(){
 if(!draft)return;
 const review=V.review(draft,A.getModel());$('#visionResult').hidden=false;
 $('#visionResultLabel').textContent=review.ready?'AI 草稿估重 · 待核对':'信息不足 · 暂不计算整件重量';
 $('#visionWeight').textContent=review.ready?review.result.weight.toFixed(3)+' kg':'待补充';
 $('#visionMetric').textContent=review.ready?`${(review.result.volume/1000).toFixed(2)} cm³ · 密度 ${review.model.density} g/cm³ · ${draft.basis}`:draft.basis+' · 不把未知尺寸当作 0';
 $('#visionSummary').textContent=draft.summary;
 const issues=$('#visionIssues');issues.replaceChildren();
 if(review.problems.length){issues.append(node('h3','需要核对 / 补充'));const list=node('ul','','vision-issues');for(const p of review.problems)list.append(node('li',p));issues.append(list);}
 if(draft.warnings?.length){issues.append(node('h3','识别备注'));const list=node('ul','','vision-issues');for(const p of draft.warnings)list.append(node('li',p));issues.append(list);}
 const geometry=$('#visionGeometry');geometry.replaceChildren();
 const block=(row,fields,index,kind)=>{const card=node('article','','vision-part');card.append(node('h4',`${kind} ${index+1} · ${row.name} · ${row.op==='cut'?'扣除':'增加'}`));const dl=document.createElement('dl');for(const [key,label,unit='mm'] of fields){const pair=document.createElement('div');pair.append(node('dt',label),node('dd',row[key]===null||row[key]===undefined?'未知':row[key]+' '+unit));dl.append(pair);}card.append(dl,node('p',row.evidence||'缺少依据','assistant-help'));geometry.append(card);};
 draft.segments.forEach((row,i)=>block(row,[['z','起点 Z'],['h','高度 H'],['D0','起端外径'],['D1','末端外径'],['d0','起端内径'],['d1','末端内径']],i,'回转段'));
 draft.corrections.forEach((row,i)=>block(row,[['count','数量','个'],...(E.SHAPES[row.type]?.fields||[])],i,E.SHAPES[row.type]?.name||'局部结构'));
 if(!draft.segments.length&&!draft.corrections.length)geometry.append(node('p','尚未识别出可用结构。','assistant-help'));
 $('#applyVision').disabled=!review.ready;
 $('#visionApplyHint').textContent=review.ready?'载入将替换下方当前模型。AI 可能误读标注或部位，请对照原图核对草稿后使用。':'把缺失尺寸或结构关系填入上方“补充尺寸”，再识别；也可切换到 OCR / 描点或在下方手动建模。';
}
function invalidate(){revision++;draft=null;$('#visionResult').hidden=true;error('');message(busy?'图纸或口径已改变，原任务结果将丢弃；等待当前任务结束后可重新识别。':'图纸或口径已更新，请重新识别。');}
async function run(){
 if(busy||!available)return;
 const token=revision,basis=A.getModel().basis;busy=true;draft=null;$('#runVision').disabled=true;$('#visionResult').hidden=true;error('');message('正在准备图纸…');const started=Date.now();
 try{
 const snapshot=await D.snapshot();if(token!==revision)return;
 const response=await fetch('/api/vision/jobs',{method:'POST',headers:{'Content-Type':'application/json','X-Casting-Client':'drawing-assistant'},body:JSON.stringify({image:snapshot.image,basis,notes:$('#visionNotes').value}),signal:AbortSignal.timeout(15000)});
 const created=await response.json();if(!response.ok)throw new Error(created.error||'无法创建识图任务。');
 while(Date.now()-started<660000){
  await delay(1400);
  const r=await fetch('/api/vision/jobs/'+encodeURIComponent(created.job_id),{signal:AbortSignal.timeout(10000)}),job=await r.json();
  if(!r.ok)throw new Error(job.error||'无法读取识图进度。');
  const stale=token!==revision||snapshot.version!==D.getVersion()||basis!==A.getModel().basis;
  if(job.state==='error')throw new Error(job.error||'识图失败。');
  if(job.state==='done'){
   if(stale){message('原任务已结束。当前图纸或口径已改变，请重新识别。');return;}
   draft=job.result.draft;render();message(`本机识图完成，用时 ${Math.round((Date.now()-started)/1000)} 秒。尺寸与结构依据见下方。`);return;
  }
  if(!stale)message(`${job.message} 已等待 ${Math.round((Date.now()-started)/1000)} 秒。`);
 }
 throw new Error('识图等待超时，请稍后重试或使用手动输入。');
 }catch(e){if(token===revision){error(e.name==='TimeoutError'?'本机识图请求超时，请检查连接后重试。':e.message);message('AI 识别未完成，OCR / 手动输入 / 描点仍可用。');}}
 finally{busy=false;$('#runVision').disabled=!available;}
}
$('#runVision').addEventListener('click',run);$('#refreshVision').addEventListener('click',check);
$('#applyVision').addEventListener('click',()=>{try{const review=V.review(draft,A.getModel());if(!review.ready)throw new Error('请先补齐缺失信息后重新识别。');A.setModel(review.model);message('AI 草稿已载入，重量与三维主体已更新。可在下方逐段核对和修改。');}catch(e){error(e.message);}});
window.addEventListener('casting-drawing-change',invalidate);
$('#dimensionBasis').addEventListener('change',invalidate);
for(const id of ['density','quantity'])$('#'+id).addEventListener('input',()=>{if(draft)render();});
check();
})();
