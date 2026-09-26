import {cube,cyl,sphere,union,cut,transform,prism,revolve} from './geometry.mjs';
const dim=(key,label,value,min=.1,max=5000)=>({key,label,value,min,max,unit:'mm'});
export const SHAPES={
 cylinder:{name:'圆柱',fields:[dim('D','直径',100),dim('H','高度',40)]},
 tube:{name:'圆管 / 圆环',fields:[dim('D','外径',150),dim('bore','内径',80,0),dim('H','高度',30)]},
 box:{name:'长方体 / 板',fields:[dim('L','长度 X',100),dim('W','宽度 Y',70),dim('H','高度 Z',20)]},
 cone:{name:'圆锥 / 圆台',fields:[dim('D','底面直径',100),dim('endD','顶面直径',50,0),dim('H','高度',60)]},
 conetube:{name:'锥形管',fields:[dim('D','底部外径',120),dim('bore','底部内径',90,0),dim('endD','顶部外径',80),dim('endBore','顶部内径',50,0),dim('H','高度',60)]},
 wedge:{name:'三角筋 / 楔块',fields:[dim('L','底边长度 X',70),dim('W','筋厚 Y',8),dim('H','高度 Z',50)]},
 sphere:{name:'球体',fields:[dim('D','直径',80)]},
 torus:{name:'圆截面圆环',fields:[dim('centerD','中心圆直径',100),dim('tubeD','截面直径',16)]},
 capsule:{name:'腰形柱 / 腰形孔',fields:[dim('L','总长 X',100),dim('W','宽度 Y',40),dim('H','高度 Z',20)]},
 regular:{name:'正多边形柱',fields:[dim('D','外接圆直径',80),dim('H','高度',25),{key:'sides',label:'边数',value:6,min:3,max:32,unit:'条'}]},
 extrude:{name:'自定义截面拉伸',fields:[dim('H','拉伸高度 Z',30)],profile:'-50,-30\n50,-30\n50,10\n0,35\n-50,10',profileLabel:'截面顶点 X,Y（每行一点，mm）'},
 revolve:{name:'自定义截面回转',fields:[],profile:'30,0\n65,0\n65,12\n48,12\n48,55\n30,55',profileLabel:'截面顶点 R,Z（每行一点，mm）'}
};
export const MAX_COMPONENTS=40;
export function newComponent(type='tube',id='part-1'){
 const shape=SHAPES[type];if(!shape)throw Error('不支持的组合形状。');
 return {id,name:shape.name,type,operation:'add',enabled:true,values:Object.fromEntries(shape.fields.map(x=>[x.key,x.value])),...(shape.profile?{profile:shape.profile}:{}),position:[0,0,0],rotation:[0,0,0],array:{type:'none',count:4,step:[60,0,0],radius:80,angle:0}};
}
export function normalizeComponents(input){
 if(!Array.isArray(input)||input.length>MAX_COMPONENTS)throw Error(`自定义组合最多支持 ${MAX_COMPONENTS} 个构件。`);
 const ids=new Set();return input.map(raw=>{
  if(!raw||!SHAPES[raw.type]||typeof raw.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(raw.id)||ids.has(raw.id))throw Error('组合构件类型或编号无效。');
  ids.add(raw.id);const c=newComponent(raw.type,raw.id);c.name=String(raw.name||SHAPES[c.type].name).slice(0,60);
  if(!['add','cut'].includes(raw.operation)||typeof raw.enabled!=='boolean')throw Error(c.name+'：材料操作无效。');
  c.operation=raw.operation;c.enabled=raw.enabled;
  for(const field of SHAPES[c.type].fields){const v=raw.values?.[field.key];if(!Number.isFinite(v)||v<field.min||v>field.max||(field.unit==='条'&&!Number.isInteger(v)))throw Error(`${c.name}：${field.label}应在 ${field.min}～${field.max} ${field.unit}之间。`);c.values[field.key]=v;}
  for(const key of ['position','rotation']){const bound=key==='position'?50000:36000;if(!Array.isArray(raw[key])||raw[key].length!==3||raw[key].some(v=>!Number.isFinite(v)||Math.abs(v)>bound))throw Error(c.name+'：位置或旋转角无效。');c[key]=[...raw[key]];}
  if(SHAPES[c.type].profile){if(typeof raw.profile!=='string'||raw.profile.length>5000)throw Error(c.name+'：截面数据无效。');c.profile=raw.profile;parseProfile(c.profile,c.type==='revolve');}
  const a=raw.array??c.array;
  if(!['none','line','circle'].includes(a.type)||!Number.isInteger(a.count)||a.count<1||a.count>32||!Array.isArray(a.step)||a.step.length!==3||a.step.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)||!Number.isFinite(a.radius)||a.radius<0||a.radius>10000||!Number.isFinite(a.angle)||Math.abs(a.angle)>36000)throw Error(c.name+'：阵列参数无效（数量为 1～32）。');
  c.array={type:a.type,count:a.count,step:[...a.step],radius:a.radius,angle:a.angle};return c;
 });
}
export function parseProfile(text,radial=false){
 const rows=text.trim().split(/[\n;；]+/).filter(s=>s.trim());
 const points=rows.map(row=>row.trim().split(/[\s,，]+/).map(Number));
 if(points.length<3||points.length>64||points.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>5000)||(radial&&p[0]<0)))throw Error('截面需 3～64 个顶点，每行两个有限坐标；回转半径 R 不能为负。');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a,b,c)=>Math.abs(cross(a,b,c))<1e-8&&c[0]>=Math.min(a[0],b[0])-1e-8&&c[0]<=Math.max(a[0],b[0])+1e-8&&c[1]>=Math.min(a[1],b[1])-1e-8&&c[1]<=Math.max(a[1],b[1])+1e-8;
 const n=points.length;
 for(let i=0;i<n;i++){
  const a=points[i],b=points[(i+1)%n];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)throw Error('截面有重复顶点；末尾不需要重复第一个点。');
  const prev=points[(i+n-1)%n];if(Math.abs(cross(prev,a,b))<1e-8&&(prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1])>0)throw Error('截面边不能折返重叠。');
  for(let j=i+1;j<n;j++){if(j===i+1||i===0&&j===n-1)continue;const c=points[j],d=points[(j+1)%n];
   if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('截面轮廓不能自交或相切，请按轮廓顺序输入。');
  }
 }
 const area=points.reduce((v,p,i)=>v+p[0]*points[(i+1)%n][1]-p[1]*points[(i+1)%n][0],0)/2;
 if(Math.abs(area)<1e-6)throw Error('截面面积必须大于 0。');return area>0?points:points.reverse();
}
export function componentShape(c){
 const p=c.values;let body;
 const hollow=(outer,inner)=>inner>0?cut(outer,cyl(inner/2,p.H+2,[0,0,-1])):outer;
 switch(c.type){
  case 'box':body=cube(p.L,p.W,p.H,[-p.L/2,-p.W/2,0]);break;
  case 'cylinder':body=cyl(p.D/2,p.H);break;
  case 'tube':if(p.bore>=p.D)throw Error(c.name+'：内径必须小于外径。');body=hollow(cyl(p.D/2,p.H),p.bore);break;
  case 'cone':body=cyl(p.D/2,p.H,[0,0,0],p.endD/2);break;
  case 'conetube':if(p.bore>=p.D||p.endBore>=p.endD)throw Error(c.name+'：两端内径均须小于外径。');body=revolve([[p.bore/2,0],[p.D/2,0],[p.endD/2,p.H],[p.endBore/2,p.H]]);break;
  case 'wedge':body=transform(prism([[0,0],[p.L,0],[0,p.H]],p.W),[90,0,0],[-p.L/2,p.W/2,0]);break;
  case 'sphere':body=sphere(p.D/2,[0,0,p.D/2]);break;
  case 'torus':if(p.tubeD>=p.centerD)throw Error(c.name+'：中心圆直径应大于截面直径。');body=revolve(Array.from({length:128},(_,i)=>{const a=i*2*Math.PI/128;return [p.centerD/2+p.tubeD/2*Math.cos(a),p.tubeD/2*(1+Math.sin(a))];}));break;
  case 'capsule':if(p.L<p.W)throw Error(c.name+'：腰形总长不能小于宽度。');body=p.L===p.W?cyl(p.W/2,p.H):union(cube(p.L-p.W,p.W,p.H,[-(p.L-p.W)/2,-p.W/2,0]),[-1,1].map(sign=>cyl(p.W/2,p.H,[sign*(p.L-p.W)/2,0,0])));break;
  case 'regular':body=prism(Array.from({length:p.sides},(_,i)=>[p.D/2*Math.cos(i*2*Math.PI/p.sides),p.D/2*Math.sin(i*2*Math.PI/p.sides)]),p.H);break;
  case 'extrude':body=prism(parseProfile(c.profile),p.H);break;
  case 'revolve':body=revolve(parseProfile(c.profile,true));break;
 }
 const a=c.array,n=a.type==='none'?1:a.count;
 return union(Array.from({length:n},(_,i)=>a.type==='circle'?transform(transform(body,c.rotation,[a.radius,0,0]),[0,0,a.angle+i*360/n],c.position):transform(body,c.rotation,c.position.map((v,j)=>v+(a.type==='line'?i*a.step[j]:0)))));
}
export function buildCustom(state){
 const groups=[],cuts=[],toolGroups=[];let count=0;
 for(const c of state.components){if(!c.enabled)continue;count+=c.array.type==='none'?1:c.array.count;if(count>128)throw Error('启用构件的阵列总数不能超过 128 个。');
  const shape=componentShape(c),group={id:c.id,label:c.name,shape,keys:[]};if(c.operation==='add')groups.push(group);else{cuts.push(shape);toolGroups.push(group);}
 }
 if(!groups.length)throw Error('请至少添加并启用一个“添加材料”的构件。');
 return {groups,cuts,toolGroups};
}
export function customRows(state){
 const rows=[];
 for(const c of state.components){const a=c.array;rows.push([c.name,SHAPES[c.type].name,(c.enabled?'启用':'停用')+' · '+(c.operation==='add'?'添加材料':'减去材料')]);for(const f of SHAPES[c.type].fields)rows.push([c.name+' / '+f.label,c.values[f.key]+' '+f.unit,'手动定义']);if(c.profile)rows.push([c.name+' / 截面坐标',c.profile,'手动定义']);rows.push([c.name+' / 位置 X,Y,Z',c.position.join(', ')+' mm','旋转后平移'],[c.name+' / 旋转 X,Y,Z',c.rotation.join(', ')+' °','绕原点']);if(a.type!=='none')rows.push([c.name+' / 阵列',a.count+' 个',a.type==='circle'?`圆周半径 ${a.radius} mm，起始角 ${a.angle}°`:'线性步距 '+a.step.join(', ')+' mm']);}
 return rows;
}
