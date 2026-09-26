(()=>{
'use strict';
const $=id=>document.getElementById(id);
$('saveProject').onclick=()=>{
 const model=globalThis.CastingApp.getModel(),r=globalThis.CastingEngine.calculate(model);
 if(!r.valid){$('projectStatus').textContent='请先修正当前模型中的无效尺寸。';return;}
 const data={format:'casting-weight-project',version:1,savedAt:new Date().toISOString(),model};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=(model.name||'铸件').replace(/[\\/:*?"<>|]/g,'_')+'-计算方案.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('projectStatus').textContent='已导出计算方案（包含尺寸及来源，不包含原图）。';
};
$('loadProject').onchange=async ev=>{const file=ev.target.files[0];ev.target.value='';if(!file)return;try{
 if(file.size>2*1024*1024)throw Error('计算方案须小于 2 MB。');
 const data=JSON.parse(await file.text());const m=data?.model;
 if(data.format!=='casting-weight-project'||data.version!==1||!m||!Array.isArray(m.segments)||m.segments.length>600||!Array.isArray(m.corrections)||m.corrections.length>100)throw Error('不是支持的铸衡计算方案。');
 if(!['毛坯尺寸','加工后尺寸'].includes(m.basis))throw Error('方案中的计算口径无效。');
 const next={name:String(m.name||'载入方案').slice(0,80),source:String(m.source||'载入计算方案').slice(0,3000),density:m.density,quantity:m.quantity,basis:m.basis,
 segments:m.segments.map(s=>({name:String(s.name||'回转段').slice(0,60),op:s.op,z:s.z,h:s.h,D0:s.D0,D1:s.D1,d0:s.d0,d1:s.d1})),
 corrections:m.corrections.map(c=>({name:String(c.name||'局部结构').slice(0,60),type:c.type,op:c.op,a:c.a,b:c.b,c:c.c,d:c.d,count:c.count}))};
 globalThis.CastingApp.setModel(next);$('projectStatus').textContent='已载入 '+next.name+'，尺寸与重量可继续编辑。';
 }catch(e){$('projectStatus').textContent='载入失败：'+e.message;}};
})();
