/* Model output never supplies the weight. The existing geometry engine does. */
(function(root){
'use strict';
const E=root.CastingEngine||(typeof require==='function'?require('./engine.js'):null);
function review(draft,current){
 const problems=[];
 if(!draft||!Array.isArray(draft.segments)||!Array.isArray(draft.corrections))return {ready:false,problems:['识别数据无效。']};
 if(draft.basis!==current.basis||draft.units!=='mm')problems.push('识别口径与当前设置不同，请重新识别。');
 if(draft.complete!==true)problems.push('结构尚未完整，暂不显示整件重量。');
 if(!Array.isArray(draft.missing))problems.push('识别结果缺少完整性检查。');
 else problems.push(...draft.missing);
 const segments=draft.segments.map(s=>({name:s.name,op:s.op,...Object.fromEntries(['z','h','D0','D1','d0','d1'].map(k=>[k,s[k]]))}));
 const corrections=draft.corrections.map(c=>({name:c.name,type:c.type,op:c.op,count:c.count,...Object.fromEntries((E.SHAPES[c.type]?.fields||[]).map(([k])=>[k,c[k]]))}));
 const model={name:draft.name||'图纸识别铸件',density:current.density,quantity:current.quantity,basis:draft.basis,segments,corrections,source:'AI 图纸草稿 · 请核对原图'};
 if([...draft.segments,...draft.corrections].some(row=>!row.evidence?.trim()))problems.push('部分结构缺少图纸依据。');
 const result=E.calculate(model);
 if(!result.valid)problems.push(...result.errors);
 return {ready:problems.length===0,problems:[...new Set(problems)],model,result:problems.length?null:result};
}
root.CastingVisionCore={review};
if(typeof module!=='undefined')module.exports={review};
})(globalThis);
