import {SHAPES,newComponent,MAX_COMPONENTS} from './custom.mjs';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(label,path,value,min=-50000,max=50000,unit='mm')=>`<label class="custom-number">${esc(label)}<span class="number-wrap"><input type="number" step="any" data-custom-field="${path}" aria-label="${esc(label)}" min="${min}" max="${max}" value="${Number.isFinite(value)?value:''}"><span>${unit}</span></span></label>`;
export class CustomEditor{
 constructor(root,changed,pick){this.root=root;this.changed=changed;this.pick=pick;this.undo=[];this.redo=[];root.addEventListener('click',e=>this.click(e));root.addEventListener('input',e=>this.input(e));}
 remember(){this.undo.push(structuredClone(this.state.components));if(this.undo.length>30)this.undo.shift();this.redo=[];}
 current(){return this.state.components.find(c=>c.id===this.selected);}
 select(id){this.selected=id;this.render(this.state);this.pick(id);}
 render(state){
  if(this.state!==state){this.undo=[];this.redo=[];}this.state=state;
  if(!state.components.some(c=>c.id===this.selected))this.selected=state.components[0]?.id;
  const c=this.current(),shape=c&&SHAPES[c.type],motionOpen=this.root.querySelector('#custom-motion')?.open,arrayOpen=this.root.querySelector('#custom-array')?.open;
  this.root.innerHTML=`<div class="custom-add"><label for="custom-shape">选择形状</label><div><select id="custom-shape">${Object.entries(SHAPES).map(([key,s])=>`<option value="${key}">${s.name}</option>`).join('')}</select><button data-custom-action="add" ${state.components.length>=MAX_COMPONENTS?'disabled':''}>添加</button></div></div><div class="custom-toolbar"><span>${state.components.length} / ${MAX_COMPONENTS} 个构件</span><button data-custom-action="undo" ${this.undo.length?'':'disabled'}>撤销</button><button data-custom-action="redo" ${this.redo.length?'':'disabled'}>重做</button></div><div class="custom-list" aria-label="组合构件">${state.components.map((x,i)=>`<button data-custom-select="${x.id}" class="${x.id===this.selected?'active':''}" aria-pressed="${x.id===this.selected}"><b>${i+1}. ${esc(x.name)}</b><small>${x.enabled?(x.operation==='add'?'＋ 添加材料':'－ 减料'):'已停用'} · ${SHAPES[x.type].name}${x.array.type!=='none'?' × '+x.array.count:''}</small></button>`).join('')}</div>${!c?'<p class="custom-help">选择一个形状，点击“添加”开始组合。</p>':`<div class="custom-selected"><label for="custom-name">构件名称</label><input id="custom-name" data-custom-field="name" maxlength="60" value="${esc(c.name)}"><div class="custom-operation"><label for="custom-operation">材料操作</label><select id="custom-operation" data-custom-field="operation"><option value="add" ${c.operation==='add'?'selected':''}>添加材料</option><option value="cut" ${c.operation==='cut'?'selected':''}>减去材料 / 挖孔</option></select><label class="custom-enabled"><input data-custom-field="enabled" type="checkbox" ${c.enabled?'checked':''}>启用</label></div><div class="custom-grid">${shape.fields.map(f=>number(f.label,'values.'+f.key,c.values[f.key],f.min,f.max,f.unit)).join('')}</div>${shape.profile?`<label class="profile-label" for="custom-profile">${shape.profileLabel}</label><textarea id="custom-profile" data-custom-field="profile" rows="6" spellcheck="false">${esc(c.profile)}</textarea><p class="custom-help">按边界顺序输入，自动闭合；末点无需重复首点，轮廓不能自交。</p>`:''}<details id="custom-motion" ${motionOpen?'open':''}><summary>位置与旋转</summary><div class="custom-grid">${['X','Y','Z'].map((k,i)=>number('位置 '+k,'position.'+i,c.position[i])).join('')}${['X','Y','Z'].map((k,i)=>number('旋转 '+k,'rotation.'+i,c.rotation[i],-36000,36000,'°')).join('')}</div><p class="custom-help">常用形状以底面中心为原点；自定义截面按输入坐标。先绕 X、Y、Z 轴旋转，再平移。</p></details><details id="custom-array" ${arrayOpen?'open':''}><summary>重复排列</summary><label for="custom-array-type">排列方式</label><select id="custom-array-type" data-custom-field="array.type">${[['none','单个'],['line','直线排列'],['circle','圆周排列（绕 Z 轴）']].map(([k,v])=>`<option value="${k}" ${c.array.type===k?'selected':''}>${v}</option>`).join('')}</select>${c.array.type!=='none'?`<div class="custom-grid">${number('排列数量','array.count',c.array.count,1,32,'个')}${c.array.type==='circle'?number('圆周半径','array.radius',c.array.radius,0,10000)+number('起始角度','array.angle',c.array.angle,-36000,36000,'°'):['X','Y','Z'].map((k,i)=>number('每个间距 '+k,'array.step.'+i,c.array.step[i],-10000,10000)).join('')}</div>`:''}<p class="custom-help">圆周排列以“位置”坐标为圆心，构件方向随角度转动。</p></details><div class="custom-buttons"><button data-custom-action="copy">复制构件</button><button data-custom-action="delete">删除构件</button></div></div>`}<p class="custom-help">所有加料取并集，再统一减料。相交材料只计一次；红色减料体仅作定位参考。</p>`;
 }
 input(e){
  const path=e.target.dataset.customField,c=this.current();if(!path||!c)return;this.remember();
  let value=['name','profile','operation','array.type'].includes(path)?e.target.value:path==='enabled'?e.target.checked:e.target.value===''?NaN:Number(e.target.value);
  const keys=path.split('.');let target=c;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=value;
  if(['array.type','operation','enabled'].includes(path))this.render(this.state);else{
   const row=this.root.querySelector(`[data-custom-select="${c.id}"] b`);if(path==='name'&&row)row.textContent=(this.state.components.indexOf(c)+1)+'. '+value;
   const caption=this.root.querySelector(`[data-custom-select="${c.id}"] small`);if(caption)caption.textContent=(c.enabled?(c.operation==='add'?'＋ 添加材料':'－ 减料'):'已停用')+' · '+SHAPES[c.type].name+(c.array.type!=='none'?' × '+c.array.count:'');
   this.root.querySelector('[data-custom-action="undo"]').disabled=false;this.root.querySelector('[data-custom-action="redo"]').disabled=true;
  }
  this.changed();
 }
 click(e){
  const choice=e.target.closest('[data-custom-select]');if(choice){this.select(choice.dataset.customSelect);return;}
  const action=e.target.closest('[data-custom-action]')?.dataset.customAction;if(!action)return;
  const c=this.current(),id=()=> 'part-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
  if(action==='undo'||action==='redo'){
   const from=action==='undo'?this.undo:this.redo,to=action==='undo'?this.redo:this.undo;if(!from.length)return;to.push(structuredClone(this.state.components));this.state.components=from.pop();
  }else{
   if((action==='add'||action==='copy')&&this.state.components.length>=MAX_COMPONENTS)return;
   this.remember();
   if(action==='add'){const component=newComponent(this.root.querySelector('#custom-shape').value,id());this.state.components.push(component);this.selected=component.id;}
   if(action==='copy'&&c){const copy=structuredClone(c);copy.id=id();copy.name=c.name+' 副本';this.state.components.push(copy);this.selected=copy.id;}
   if(action==='delete'&&c)this.state.components=this.state.components.filter(x=>x.id!==c.id);
  }
  this.render(this.state);this.changed({fit:true});this.pick(this.selected);
 }
}
