import {CustomEditor} from './custom-editor.mjs';
import {customRows} from './custom.mjs';
import {FAMILIES,getFamily,fresh,normalize,buildDesign,primaryFields,activeOptions,clone} from './catalog.mjs';
import {SolidViewer} from './viewer.mjs';
import {stlBinary} from './solid.mjs';
const $=id=>document.getElementById(id),esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=3)=>n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d});
const MASS=v=>v*state.density/1e6;
const STORAGE='casting-parametric-v1', DRAFT='casting-parametric-draft-v1';
let state=fresh(),drafts={},saved=[],result=null,revision=0,inflight=false,pending=null,timer=null,fitNext=true,selected=null,viewer,worker,storageAvailable=true;
try {const data=JSON.parse(localStorage.getItem(DRAFT)||'null');if(data?.state){state=normalize(data.state);buildDesign(state);drafts=data.drafts||{};}}catch{state=fresh();drafts={};notice('未能恢复上次草稿，已打开通用模板。');}
try {const list=JSON.parse(localStorage.getItem(STORAGE)||'[]');saved=Array.isArray(list)?list.filter(x=>x&&x.state).slice(0,100):[];}catch{notice('已保存方案的数据暂时无法读取，请使用参数文件导入。');}

function notice(message){$('status').textContent=message;}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{storageAvailable=false;notice('当前浏览器无法保存本机数据，请导出参数方案备份。');return false;}}
function remember(){drafts[state.family]=clone(state);if(writeStorage(DRAFT,{state,drafts})&&storageAvailable)notice('当前草稿已保存在此浏览器。原图和尺寸均在本机处理。');}
const customEditor=new CustomEditor($('custom-editor'),options=>requestBuild(options),id=>viewer?.setHighlight(id));
const paths={
 endcap:'M5 22 15 9h28l12 13v14L42 44H18L5 36Zm0 0 14 8h22l14-8M19 30v14m22-14v14M15 9l4 21m24-21-2 21 M25 22c0-5 11-5 11 0s-11 5-11 0',
 motor:'M10 17 38 5l17 12v21L28 49 10 37Zm0 0 18 12 27-12M28 29v20 M15 15l18 12m-12-15 18 12m-12-15 18 12m-12-15 18 12M7 34l-4 7 12 6 8-3m15-3 5 4 16-7-4-5',
 bearing:'M7 29c0-12 48-12 48 0v9c0 12-48 12-48 0Zm0 0c0 12 48 12 48 0M17 26V14c0-10 28-10 28 0v12c0 9-28 9-28 0M17 14c0 10 28 10 28 0M25 14c0-5 12-5 12 0s-12 5-12 0',
 custom:'M7 15 23 7l15 8v20l-16 9L7 35Zm0 0 15 9 16-9M22 24v20M35 29l11-6 12 6v15l-12 7-11-7m11-7v14m-11-22 11 8 12-8',
 ring:'M7 18c0-15 48-15 48 0v22c0 14-48 14-48 0Zm0 0c0 15 48 15 48 0M18 18c0-8 26-8 26 0s-26 8-26 0M18 18v8m26-8v8',
 box:'M5 16 32 4l24 14v25L28 53 5 39Zm0 0 23 14 28-12M28 30v23M13 18l19-9 16 10-20 8Zm0 0v11l15 9 20-8V19',
 watercool:'M7 18c0-12 32-12 32 0v26c0 12-32 12-32 0Zm0 0c0 12 32 12 32 0M12 18c0-8 22-8 22 0s-22 8-22 0M17 18c0-4 12-4 12 0s-12 4-12 0M39 14l14-6v26l-14 9M20 7V2h7v5M45 13V4h7v8M39 23l14-6m-14 15 14-6'
};
function drawFamilies(){ $('families').innerHTML=Object.entries(FAMILIES).map(([id,f])=>`<button class="family-card ${id===state.family?'active':''}" data-family="${id}" aria-pressed="${id===state.family}"><svg viewBox="0 0 62 58" aria-hidden="true"><path d="${paths[id]}" stroke-linejoin="round"/></svg><span><strong>${f.name}</strong><small>${f.subtitle}</small></span></button>`).join('');}
function renderEditor(){
 const f=getFamily(state.family),fields=primaryFields(state);drawFamilies();$('family-title').textContent=f.name;$('field-count').textContent=state.family==='custom'?'自由组合':fields.length+' 个主尺寸';
 $('fields').hidden=state.family==='custom';$('variants').hidden=state.family==='custom';$('custom-editor').hidden=state.family!=='custom';$('details').hidden=state.family==='custom';if(state.family==='custom')customEditor.render(state);
 $('cut-view').hidden=state.family!=='custom';
 $('variants').innerHTML=f.variants.map(([id,label])=>`<button data-variant="${id}" class="${id===state.variant?'active':''}" aria-pressed="${id===state.variant}">${label}</button>`).join('');
 $('fields').innerHTML=fields.map(x=>`<div class="field" data-field="${x.key}"><div class="field-top"><label for="p-${x.key}">${x.label}</label><span class="origin ${state.edited.includes(x.key)?'edited':''}">${state.edited.includes(x.key)?'已填写':'模板值'}</span></div><div class="number-wrap"><input id="p-${x.key}" data-primary="${x.key}" type="number" min="${x.min}" max="${x.max}" step="any" value="${state.values[x.key]??''}"><span>mm</span></div></div>`).join('');
 $('features').innerHTML='<h3>结构选项</h3>'+activeOptions(state).map(([key,label,choices])=>`<div class="feature"><span class="feature-label">${label}</span><div class="feature-options" role="group" aria-label="${label}">${choices.map(([v,text],i)=>`<button data-feature="${key}" data-choice="${i}" class="${state.features[key]===v?'active':''}" aria-pressed="${state.features[key]===v}">${text}</button>`).join('')}</div></div>${state.family==='watercool'&&key==='flange'&&state.features.flange?'<div class="flange-controls"><div id="flange-fields" class="flange-grid"></div><p>沿轴向分别设置，均包含在机座总长内。A / B 端见三维标记；封水环厚度在细节中另设。</p></div>':''}`).join('');
 $('features').hidden=!activeOptions(state).length;
 if(state.family==='endcap'&&state.variant==='b5')$('features').insertAdjacentHTML('afterbegin','<div class="b5-flange-controls"><h3>B5 安装法兰</h3><div id="b5-flange-fields" class="flange-grid"></div><p class="custom-help">安装法兰在盖底侧；厚度与定位止口均包含在总深度内。</p></div>');
 $('quantity').value=state.quantity;$('density').value=state.density;$('basis').value=state.basis;
 updateBasis();selected=null;viewer?.setHighlight(null);
 $('water-view').hidden=state.family!=='watercool';
 if(viewer&&viewer.result?.state.family!==state.family){viewer.setSection(state.family==='watercool');viewer.setWater(false);syncViewButtons();}
}
function updateBasis(){$('basis-badge').textContent=state.basis==='毛坯尺寸'?'毛坯':'加工后';$('density-label').textContent='灰铸铁 · '+state.density;$('model-label').textContent=state.name;}
function renderDetails(details){
 if(state.family==='custom'){$('preset-notice').textContent='组合尺寸、位置和阵列均按左侧输入计算。可点击实体或构件列表继续编辑。';return;}
 const active=document.activeElement?.dataset.detail;
 const quickKeys=state.family==='watercool'&&state.features.flange?['flangeAWidth','flangeBWidth']:state.family==='endcap'&&state.variant==='b5'?['mountFlangeD','mountFlangeT']:[],advanced=details.filter(x=>!quickKeys.includes(x.key));
 for(const [container,list] of [[$('detail-fields'),advanced],[$('flange-fields')||$('b5-flange-fields'),details.filter(x=>quickKeys.includes(x.key))]]){
  if(!container)continue;
  if(container.dataset.keys!==list.map(x=>x.key).join('|')){
   container.innerHTML=list.map(x=>`<div class="detail-field" data-field="${x.key}"><label for="d-${x.key}">${esc(x.label)}</label><div class="number-wrap"><input id="d-${x.key}" data-detail="${x.key}" type="number" step="${x.unit==='个'?1:'any'}"><span>${x.unit}</span></div><button type="button" data-restore="${x.key}"></button></div>`).join('');
   container.dataset.keys=list.map(x=>x.key).join('|');
  }
 }
 for(const x of details){const input=$('d-'+x.key);if(active!==x.key)input.value=x.value;input.min=x.min;input.max=x.max;const btn=input.closest('.detail-field').querySelector('button');btn.disabled=!x.overridden;btn.textContent=x.overridden?'已单独设置 · 恢复联动':'随主尺寸联动';}
 const count=details.filter(d=>d.overridden).length,advancedCount=advanced.filter(d=>d.overridden).length;$('detail-count').textContent=advanced.length?`${advanced.length} 项 · ${advancedCount?advancedCount+' 项已单设':'全部联动'}`:'此款无需额外尺寸';$('reset-details').disabled=!Object.keys(state.overrides).length;
 const unedited=primaryFields(state).filter(x=>!state.edited.includes(x.key)).length;
 $('preset-notice').innerHTML=`${unedited?unedited+' 个主尺寸尚为模板值；':''}${details.length-count} 项细节按比例联动。<button class="preset-link" id="show-details">查看细节</button><br>这是通用结构估算，请先核对三维形状与图纸。`;
 $('show-details').onclick=()=>{$('details').open=true;$('details').scrollIntoView({block:'nearest',behavior:'smooth'});};
 if(active&&document.activeElement?.dataset.detail!==active)$('d-'+active)?.focus();
}
function invalidate(){result=null;$('water-summary').hidden=true;$('mini-weight').textContent='估重 — kg';$('weight').innerHTML='—<small>kg</small>';$('total').textContent='—';$('volume').textContent='等待实体重建';$('parts').replaceChildren();for(const id of ['save','export'])$(id).disabled=true;$('viewer').classList.add('model-error-state');}
function showError(message){invalidate();notice('当前输入尚未保存，修正尺寸后会自动保存草稿。');$('error').textContent=message;$('error').hidden=false;$('loading').hidden=true;$('volume').textContent='尺寸无效，暂不计算';$('caption').textContent='当前尺寸未形成有效模型，请按提示调整。';viewer?.clear();viewer?.tagLayer.replaceChildren();$('warnings').hidden=true;}
function requestBuild({fit=false}={}){
 fitNext ||= fit;clearTimeout(timer);revision++;pending=null;invalidate();$('error').hidden=true;$('loading').hidden=false;$('loading').textContent='正在更新实体…';updateBasis();
 try{const design=buildDesign(state);renderDetails(design.details);pending={id:revision,state:clone(state)};timer=setTimeout(pump,180);}catch(e){showError(e.message);}
}
function pump(){if(inflight||!pending||!worker)return;inflight=true;const next=pending;pending=null;worker.postMessage(next);}
function renderResult(r){
 result=r;const mass=MASS(r.volume);$('mini-weight').textContent='估重 '+fmt(mass)+' kg';$('weight').innerHTML=fmt(mass)+'<small>kg</small>';$('volume').textContent='实体体积 '+fmt(r.volume/1000,2)+' cm³';$('total').textContent=fmt(mass*state.quantity)+' kg';
 $('parts').innerHTML=r.parts.filter(p=>p.volume>0).map(p=>`<button class="part-row ${selected===p.id?'selected':''}" data-part="${p.id}" aria-label="选择${p.label}"><div><span>${p.label}</span><b>${fmt(MASS(p.volume))} kg</b></div><div class="bar"><i style="width:${100*p.volume/r.volume}%"></i></div></button>`).join('');
 const notes=[...r.warnings];if(r.water?.components>1)notes.push('水套存在多个不连通空腔，请核对隔水筋与过水窗口。');
 $('water-summary').hidden=!r.water;if(r.water)$('water-summary').innerHTML=`<strong>水套净容积 ${fmt(r.water.volume/1e6)} L</strong><span>净厚 ${fmt(r.water.gap,2)} mm · 有效长 ${fmt(r.water.length,2)} mm</span><small>空腔不计入铸件重量，不含接管容积</small>`;if(r.components!==1)notes.push(`当前实体有 ${r.components} 个不相连部分，请检查连接尺寸；重量包含全部部分。`);
 $('warnings').textContent=notes.join(' ');$('warnings').hidden=!notes.length;$('loading').hidden=true;$('viewer').classList.remove('model-error-state');
 $('caption').textContent=!viewer?'此浏览器无法显示三维，请启用硬件加速或更换支持 WebGL 的浏览器。':viewer.showWater?'蓝色为水套空腔，不计入铸件重量；透明部分为铸件。':viewer.section?'剖切仅用于查看内部，重量和导出仍为完整模型。':'点击三维部位或右侧重量分布，可定位关联尺寸。相交材料只计一次。';
 $('model-label').textContent=r.label+' · '+state.basis;$('save').disabled=false;$('export').disabled=false;renderDetails(r.details);viewer?.update(r,{fit:fitNext});syncViewButtons();fitNext=false;remember();
}
function selectPart(id){if(!result)return;if(state.family==='custom'){customEditor.select(id);selected=id;const c=state.components.find(x=>x.id===id);$('caption').textContent=c?('已选：'+c.name+'。在左侧调整尺寸、位置或材料操作。'):'';return;}const part=result.parts.find(p=>p.id===id);if(!part)return;selected=id;viewer?.setHighlight(id);document.querySelectorAll('[data-part]').forEach(el=>el.classList.toggle('selected',el.dataset.part===id));document.querySelectorAll('[data-field]').forEach(el=>el.classList.toggle('selected',part.keys.includes(el.dataset.field)));$('caption').textContent=`已选：${part.label} · ${fmt(MASS(part.volume))} kg。高亮尺寸可调整此部位；相交体积已去重。`;const keys=part.keys.filter(k=>$('p-'+k)||$('d-'+k));const detail=keys.find(k=>$('d-'+k)?.closest('#details'));if(detail)$('details').open=true;}
function focusDimension(key){const el=$('p-'+key)||$('d-'+key);if(!el)return;if(el.closest('#details'))$('details').open=true;el.focus();el.select();el.scrollIntoView({block:'nearest',behavior:'smooth'});}
function loadState(value){const next=normalize(value);buildDesign(next);state=next;renderEditor();requestBuild({fit:true});}
$('families').onclick=e=>{const b=e.target.closest('[data-family]');if(!b||b.dataset.family===state.family)return;try{buildDesign(state);drafts[state.family]=clone(state);}catch{}const id=b.dataset.family;try{loadState(drafts[id]||fresh(id));}catch{loadState(fresh(id));}};
$('variants').onclick=e=>{const b=e.target.closest('[data-variant]');if(!b)return;state.variant=b.dataset.variant;renderEditor();requestBuild({fit:true});};
$('fields').oninput=e=>{const key=e.target.dataset.primary;if(!key)return;state.values[key]=e.target.value===''?null:Number(e.target.value);if(!state.edited.includes(key))state.edited.push(key);const badge=e.target.closest('.field').querySelector('.origin');badge.textContent='已填写';badge.classList.add('edited');requestBuild();};
$('features').onclick=e=>{const b=e.target.closest('[data-feature]');if(!b){restoreDetail(e);return;}const o=getFamily(state.family).options.find(x=>x[0]===b.dataset.feature);state.features[o[0]]=o[2][Number(b.dataset.choice)][0];renderEditor();requestBuild();};
function editDetail(e){const key=e.target.dataset.detail;if(!key)return;state.overrides[key]=e.target.value===''?NaN:Number(e.target.value);requestBuild();}
function restoreDetail(e){const b=e.target.closest('[data-restore]');if(!b)return;delete state.overrides[b.dataset.restore];requestBuild();}
$('features').oninput=editDetail;$('detail-fields').oninput=editDetail;
$('detail-fields').onclick=restoreDetail;
$('reset-details').onclick=()=>{state.overrides={};requestBuild();};
for(const id of ['density','quantity'])$(id).oninput=e=>{state[id]=e.target.value===''?null:Number(e.target.value);requestBuild();};
$('basis').onchange=e=>{state.basis=e.target.value;requestBuild();};
$('parts').onclick=e=>{const b=e.target.closest('[data-part]');if(b)selectPart(b.dataset.part);};
$('section').onclick=()=>{if(!viewer)return;viewer.setSection(!viewer.section);$('section').classList.toggle('active',viewer.section);$('section').setAttribute('aria-pressed',viewer.section);$('caption').textContent=viewer.showWater?'蓝色为水套空腔，不计入铸件重量；透明部分为铸件。':viewer.section?'剖切仅用于查看内部，重量和导出仍为完整模型。':'完整实体 · 点击部位可定位关联尺寸。';};
function syncViewButtons(){for(const [id,on] of [['section',!!viewer?.section],['water-view',!!viewer?.showWater],['cut-view',!!viewer?.showTools]]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}}
$('cut-view').onclick=()=>{if(!viewer)return;viewer.setTools(!viewer.showTools);syncViewButtons();$('caption').textContent=viewer.showTools?'红色为减料体，显示仅用于定位；重量与 STL 均为扣除后的铸件。':'点击材料或构件列表可调整尺寸与位置。';};
$('water-view').onclick=()=>{if(!result?.water||!viewer)return;viewer.setWater(!viewer.showWater);syncViewButtons();$('caption').textContent=viewer.showWater?'蓝色显示水套空腔，灰色透明显示铸件；水不计重，导出仍为完整铸件实体。':'水套空腔已扣重。可用剖切核对内外筒、封水环和隔水筋。';};
$('reset-view').onclick=()=>viewer?.reset();
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
$('help').onclick=()=>$('help-dialog').showModal();
$('save').onclick=()=>{if(!result)return;$('plan-name').value=state.name;$('save-dialog').showModal();$('plan-name').select();};
$('save-form').onsubmit=e=>{e.preventDefault();if(!result)return;if(saved.length>=100){notice('最多保存 100 个方案，请先导出备份并整理已有方案。');$('save-dialog').close();return;}state.name=$('plan-name').value.trim()||getFamily(state.family).name;const next={id:crypto.randomUUID?crypto.randomUUID():Date.now().toString(),updated:new Date().toISOString(),state:clone(state)};const list=[next,...saved].slice(0,100);if(writeStorage(STORAGE,list)){saved=list;remember();$('save-dialog').close();notice('已保存“'+state.name+'”，可在“我的方案”中复用。');}};
function renderSaved(){ $('saved-list').innerHTML=saved.length?saved.map((x,i)=>`<div class="saved-item"><button class="open-saved" data-load="${i}">${esc(x.state?.name||'未命名方案')}<small>${esc(getFamily(x.state?.family)?.name||'未知类别')} · ${esc(String(x.updated||'').slice(0,10))}</small></button><button class="remove-saved" data-remove="${i}" aria-label="删除${esc(x.state?.name||'方案')}">删除</button></div>`).join(''):'<div class="empty-message">还没有保存的方案。调整好一款后，点击“保存方案”。</div>'; }
$('my-plans').onclick=()=>{$('plan-message').hidden=true;renderSaved();$('plans-dialog').showModal();};
$('saved-list').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.load!==undefined){try{loadState(saved[Number(b.dataset.load)].state);$('plans-dialog').close();notice('已载入保存方案，可以继续修改尺寸。');}catch(err){notice('方案未能打开：'+err.message);}}else if(b.dataset.remove!==undefined){const next=saved.filter((_,i)=>i!==Number(b.dataset.remove));if(writeStorage(STORAGE,next)){saved=next;renderSaved();}}};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw Error('参数文件过大，请选择本工具导出的 JSON 文件。');loadState(JSON.parse(await file.text()));$('plans-dialog').close();notice('已导入参数方案。');}catch(err){$('plan-message').textContent='导入失败：'+err.message;$('plan-message').hidden=false;notice('导入失败：'+err.message);}finally{e.target.value='';}};
function download(contents,ext,type){const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(state.name||'铸衡方案').replace(/[\\/:*?"<>|]/g,'_')+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);notice('已导出 '+a.download);}
$('export').onclick=()=>{if(result)$('export-dialog').showModal();};
$('export-json').onclick=()=>{if(result)download(JSON.stringify(state,null,2),'json','application/json');};
$('export-stl').onclick=()=>{if(result)download(stlBinary(result.mesh),'stl','model/stl');};
$('export-report').onclick=()=>{if(!result)return;const r=result,rows=[...(state.family==='custom'?customRows(state):[]),...primaryFields(state).map(x=>[x.label,state.values[x.key]+' mm',state.edited.includes(x.key)?'手动填写':'模板默认']),...r.details.map(x=>[x.label,x.value+' '+x.unit,x.overridden?'单独设置':'模板比例联动'])];download(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.name)} · 重量清单</title><style>body{font:14px/1.7 system-ui;max-width:860px;margin:40px auto;padding:20px;color:#253f38}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{padding:9px;text-align:left;border-bottom:1px solid #d9dfd8}small{color:#6d7e73}b{font-size:23px} @media print{body{margin:0}}</style><h1>${esc(state.name)}</h1><p>${esc(r.label)} · ${esc(state.basis)} · 灰铸铁 ${state.density} g/cm³</p><b>单件 ${fmt(MASS(r.volume))} kg</b><p>${state.quantity} 件合计 ${fmt(MASS(r.volume)*state.quantity)} kg · 体积 ${fmt(r.volume/1000,3)} cm³</p>${r.water?`<p>水套净容积 ${fmt(r.water.volume/1e6)} L · 水套净厚 ${fmt(r.water.gap,2)} mm · 有效长 ${fmt(r.water.length,2)} mm（不含接管，水不计重）</p>`:''}<p>结构：${activeOptions(state).map(([k,l,choices])=>esc(l)+' '+esc(choices.find(x=>x[0]===state.features[k])?.[1]||'')).join(' / ')}</p><table><thead><tr><th>结构</th><th>净体积 cm³</th><th>重量 kg</th></tr></thead><tbody>${r.parts.map(p=>`<tr><td>${esc(p.label)}</td><td>${fmt(p.volume/1000,3)}</td><td>${fmt(MASS(p.volume))}</td></tr>`).join('')}</tbody></table><table><thead><tr><th>尺寸</th><th>数值</th><th>来源</th></tr></thead><tbody>${rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')}</tbody></table><p>提示：${esc(r.warnings.join(' '))}</p><small>计算依据：完整实体并集、孔洞交集扣除；分项按材料归属去重。通用模板不代表原图全部细节，不含未建出的圆角、拔模斜度及浇冒口。几何计算校验不等于实物称重验证。生成于 ${esc(new Date().toLocaleString('zh-CN'))}。</small></html>`,'html','text/html;charset=utf-8');};
renderEditor();
try{viewer=new SolidViewer($('viewer'),selectPart,focusDimension);if(state.family==='watercool'){viewer.setSection(true);syncViewButtons();}}catch(e){$('caption').textContent='此浏览器无法创建三维视图；重量仍可计算。请启用硬件加速或换用支持 WebGL 的浏览器。';notice('三维视图初始化失败：'+e.message);}
try{
 const url=URL.createObjectURL(new Blob([__SOLID_WORKER_SOURCE__],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);
 worker.onmessage=({data})=>{inflight=false;if(data.id===revision){if(data.error)showError(data.error);else{try{renderResult(data.result);}catch(e){showError('预览更新失败：'+e.message);}}}pump();};
 worker.onerror=e=>{inflight=false;pending=null;showError('本地三维引擎未能启动：'+(e.message||'请重新打开页面。'));};requestBuild({fit:true});
}catch(e){showError('本地三维引擎未能启动：'+e.message);}
